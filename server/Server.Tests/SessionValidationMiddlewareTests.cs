using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using FluentAssertions;
using Inventory;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;
using Xunit;

namespace Inventory.Tests;

/// <summary>
/// Tests for the most security-critical class: SessionValidationMiddleware.
/// Linked to EPIC-002 AC18 (missing session → 401), AC19 (Redis down → 503, NOT bypass — security gate).
/// </summary>
public class SessionValidationMiddlewareTests
{
    private static DefaultHttpContext MakeCtx(bool authenticated, string? jti = "test-jti")
    {
        var ctx = new DefaultHttpContext();
        if (authenticated)
        {
            var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, "1") };
            if (jti is not null) claims.Add(new Claim(JwtRegisteredClaimNames.Jti, jti));
            var identity = new ClaimsIdentity(claims, authenticationType: "TestScheme");
            ctx.User = new ClaimsPrincipal(identity);
        }
        ctx.Response.Body = new MemoryStream();
        return ctx;
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-PASSTHROUGH-ANON: anonymous request passes through unchanged")]
    public async Task Anonymous_request_passes_through()
    {
        var store = new Mock<SessionStore>(MockBehavior.Strict, Mock.Of<IConnectionMultiplexer>());
        var mw = new SessionValidationMiddleware(_ => Task.CompletedTask, store.Object, NullLogger<SessionValidationMiddleware>.Instance);
        var ctx = MakeCtx(authenticated: false);

        await mw.InvokeAsync(ctx);

        ctx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
        store.VerifyNoOtherCalls();
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-MISSING-JTI: authenticated without jti returns 401")]
    public async Task Missing_jti_returns_401()
    {
        var store = new Mock<SessionStore>(MockBehavior.Strict, Mock.Of<IConnectionMultiplexer>());
        var mw = new SessionValidationMiddleware(_ => Task.CompletedTask, store.Object, NullLogger<SessionValidationMiddleware>.Instance);
        var ctx = MakeCtx(authenticated: true, jti: null);

        await mw.InvokeAsync(ctx);

        ctx.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        (await ReadBody(ctx)).Should().Contain("missing_jti");
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-MISSING-SESSION-401: jti not in Redis returns 401 session_revoked")]
    public async Task Missing_session_returns_401()
    {
        var store = new Mock<SessionStore>();
        store.Setup(s => s.ExistsAsync("test-jti")).ReturnsAsync(false);
        var mw = new SessionValidationMiddleware(_ => Task.CompletedTask, store.Object, NullLogger<SessionValidationMiddleware>.Instance);
        var ctx = MakeCtx(authenticated: true);

        await mw.InvokeAsync(ctx);

        ctx.Response.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);
        (await ReadBody(ctx)).Should().Contain("session_revoked");
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-VALID-PASSES: valid session calls next")]
    public async Task Valid_session_calls_next()
    {
        var nextCalled = false;
        var store = new Mock<SessionStore>();
        store.Setup(s => s.ExistsAsync("test-jti")).ReturnsAsync(true);
        var mw = new SessionValidationMiddleware(
            _ => { nextCalled = true; return Task.CompletedTask; },
            store.Object, NullLogger<SessionValidationMiddleware>.Instance);
        var ctx = MakeCtx(authenticated: true);

        await mw.InvokeAsync(ctx);

        nextCalled.Should().BeTrue();
        ctx.Response.StatusCode.Should().Be(StatusCodes.Status200OK);
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-REDIS-EXCEPTION-503 (AC19 SECURITY GATE): RedisException returns 503, NOT 200")]
    public async Task Redis_exception_returns_503_not_bypass()
    {
        var store = new Mock<SessionStore>();
        store.Setup(s => s.ExistsAsync(It.IsAny<string>()))
            .ThrowsAsync(new RedisConnectionException(ConnectionFailureType.UnableToConnect, "redis dead"));
        var nextCalled = false;
        var mw = new SessionValidationMiddleware(
            _ => { nextCalled = true; return Task.CompletedTask; },
            store.Object, NullLogger<SessionValidationMiddleware>.Instance);
        var ctx = MakeCtx(authenticated: true);

        await mw.InvokeAsync(ctx);

        ctx.Response.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        (await ReadBody(ctx)).Should().Contain("auth_unavailable");
        nextCalled.Should().BeFalse("Redis down MUST NOT bypass the auth check (AC19)");
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-UNEXPECTED-EXCEPTION-503: any other exception also 503 (fail-secure)")]
    public async Task Unexpected_exception_returns_503()
    {
        var store = new Mock<SessionStore>();
        store.Setup(s => s.ExistsAsync(It.IsAny<string>()))
            .ThrowsAsync(new InvalidOperationException("boom"));
        var nextCalled = false;
        var mw = new SessionValidationMiddleware(
            _ => { nextCalled = true; return Task.CompletedTask; },
            store.Object, NullLogger<SessionValidationMiddleware>.Instance);
        var ctx = MakeCtx(authenticated: true);

        await mw.InvokeAsync(ctx);

        ctx.Response.StatusCode.Should().Be(StatusCodes.Status503ServiceUnavailable);
        nextCalled.Should().BeFalse();
    }

    [Fact(DisplayName = "EPIC-003-UT-MIDDLEWARE-KILL-SWITCH: DISABLE_REDIS_SESSION_CHECK=true passes through without Redis call")]
    public async Task Kill_switch_skips_redis_check()
    {
        Environment.SetEnvironmentVariable("DISABLE_REDIS_SESSION_CHECK", "true");
        try
        {
            var store = new Mock<SessionStore>(MockBehavior.Strict, Mock.Of<IConnectionMultiplexer>());
            var nextCalled = false;
            var mw = new SessionValidationMiddleware(
                _ => { nextCalled = true; return Task.CompletedTask; },
                store.Object, NullLogger<SessionValidationMiddleware>.Instance);
            var ctx = MakeCtx(authenticated: true);

            await mw.InvokeAsync(ctx);

            nextCalled.Should().BeTrue();
            store.Verify(s => s.ExistsAsync(It.IsAny<string>()), Times.Never);
        }
        finally
        {
            Environment.SetEnvironmentVariable("DISABLE_REDIS_SESSION_CHECK", null);
        }
    }

    private static async Task<string> ReadBody(HttpContext ctx)
    {
        ctx.Response.Body.Position = 0;
        using var reader = new StreamReader(ctx.Response.Body);
        return await reader.ReadToEndAsync();
    }
}
