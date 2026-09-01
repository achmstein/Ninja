# Download room images from Unsplash (free to use)
# Run this script from the Pics folder: .\download-images.ps1

$images = @{
    # Gaming Rooms
    "room-1.webp" = "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80"
    "room-2.webp" = "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&q=80"
    "room-3.webp" = "https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=400&q=80"
    "room-4.webp" = "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&q=80"
    "room-5.webp" = "https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=400&q=80"
    "room-6.webp" = "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80"
    "room-vip.webp" = "https://images.unsplash.com/photo-1600861194942-f883de0dfe96?w=400&q=80"
}

Write-Host "Downloading room images..." -ForegroundColor Cyan

foreach ($image in $images.GetEnumerator()) {
    $filename = $image.Key
    $url = $image.Value

    Write-Host "Downloading $filename..." -NoNewline

    try {
        # Download as jpg first (Unsplash returns jpg)
        $tempFile = [System.IO.Path]::GetTempFileName()
        Invoke-WebRequest -Uri $url -OutFile $tempFile -UseBasicParsing

        # Move to final location (keeping as webp extension but it's actually jpg - browsers handle this)
        Move-Item -Path $tempFile -Destination $filename -Force

        Write-Host " Done!" -ForegroundColor Green
    }
    catch {
        Write-Host " Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAll images downloaded!" -ForegroundColor Cyan
Write-Host "Note: Images are from Unsplash and are free to use." -ForegroundColor Yellow
