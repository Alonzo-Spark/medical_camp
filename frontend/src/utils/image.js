// Resize/compress an image client-side before upload. Vercel serverless
// functions reject request bodies larger than 4.5 MB, and source photos are
// often bigger; downscaling also keeps OCR fast without hurting accuracy.
export const compressImage = (file, maxDim = 2000, quality = 0.8) =>
    new Promise((resolve) => {
        if (!file || !file.type?.startsWith('image/')) return resolve(file);
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            URL.revokeObjectURL(url);
            let { width, height } = img;
            if (width > maxDim || height > maxDim) {
                const scale = maxDim / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            canvas.toBlob(
                (blob) => {
                    if (!blob) return resolve(file);
                    resolve(new File([blob], 'scan.jpg', { type: 'image/jpeg' }));
                },
                'image/jpeg',
                quality
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
    });
