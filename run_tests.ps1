param (
    [Parameter(Mandatory=$true)]
    [string]$RpToken
)

# Build the test image
Write-Host "Building Docker image for tests..."
docker build -t medical-camp-tests -f Dockerfile.test .

# Run the tests in Docker container and pass the Report Portal Token
Write-Host "Running tests in Docker and pushing results to Report Portal..."
docker run --rm `
    -e RP_API_KEY="$RpToken" `
    -v "$($PWD.Path)\test-results:/app/test-results" `
    --add-host host.docker.internal:host-gateway `
    medical-camp-tests

Write-Host "Test run completed!"
