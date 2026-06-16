# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/dotnet/sdk:8.0-alpine AS builder
WORKDIR /src
COPY Server.csproj ./
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS runner
WORKDIR /app
COPY --from=builder /out ./
ENV ASPNETCORE_URLS=http://0.0.0.0:3001
ENV INVENTORY_FILE=/data/inventory.xlsx
VOLUME ["/data"]
EXPOSE 3001
ENTRYPOINT ["dotnet", "Server.dll"]
