// Image comparison utility to detect duplicate player photos
export class ImageComparator {
    private static async getImageData(img: HTMLImageElement): Promise<ImageData> {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    private static dataURLToImage(dataURL: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    // Simple pixel-by-pixel comparison
    private static async comparePixels(img1: HTMLImageElement, img2: HTMLImageElement): Promise<number> {
        try {
            const data1 = await this.getImageData(img1);
            const data2 = await this.getImageData(img2);

            // Quick size check
            if (data1.width !== data2.width || data1.height !== data2.height) {
                return 0; // Different sizes
            }

            // Sample every 10th pixel for performance
            const sampleRate = 10;
            let matchingPixels = 0;
            let totalSamples = 0;

            for (let i = 0; i < data1.data.length; i += 4 * sampleRate) {
                const r1 = data1.data[i];
                const g1 = data1.data[i + 1];
                const b1 = data1.data[i + 2];
                const a1 = data1.data[i + 3];

                const r2 = data2.data[i];
                const g2 = data2.data[i + 1];
                const b2 = data2.data[i + 2];
                const a2 = data2.data[i + 3];

                // Check if pixels are similar (allow small differences for compression)
                const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2);
                if (diff < 20) { // Allow small difference threshold
                    matchingPixels++;
                }
                totalSamples++;
            }

            return totalSamples > 0 ? matchingPixels / totalSamples : 0;
        } catch (error) {
            console.error('Error comparing pixels:', error);
            return 0;
        }
    }

    // Fast hash-based comparison (less accurate but much faster)
    private static async getSimpleHash(dataURL: string): Promise<string> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Create a very simple hash based on image dimensions and a few sample pixels
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve('');
                    return;
                }

                // Scale to small size for faster processing
                const smallSize = 32;
                canvas.width = smallSize;
                canvas.height = smallSize;
                ctx.drawImage(img, 0, 0, smallSize, smallSize);

                const imageData = ctx.getImageData(0, 0, smallSize, smallSize);
                let hash = `${img.naturalWidth}x${img.naturalHeight}`;

                // Sample a few pixels
                for (let i = 0; i < imageData.data.length; i += 64) { // Sample every 16th pixel
                    hash += imageData.data[i].toString(16).padStart(2, '0');
                }

                resolve(hash);
            };
            img.onerror = () => resolve('');
            img.src = dataURL;
        });
    }

    // Main comparison function
    static async compareImages(url1: string, url2: string): Promise<{
        isSame: boolean;
        confidence: number;
        method: 'hash' | 'pixel';
    }> {
        try {
            // First try fast hash comparison
            const hash1 = await this.getSimpleHash(url1);
            const hash2 = await this.getSimpleHash(url2);

            if (hash1 === hash2 && hash1 !== '') {
                return { isSame: true, confidence: 1, method: 'hash' };
            }

            // If hashes don't match, do a more detailed comparison if URLs are data URLs
            if (url1.startsWith('data:') && url2.startsWith('data:')) {
                const img1 = await this.dataURLToImage(url1);
                const img2 = await this.dataURLToImage(url2);

                const similarity = await this.comparePixels(img1, img2);
                const isSame = similarity > 0.95; // 95% similarity threshold

                return { isSame, confidence: similarity, method: 'pixel' };
            }

            return { isSame: false, confidence: 0, method: 'hash' };
        } catch (error) {
            console.error('Error comparing images:', error);
            return { isSame: false, confidence: 0, method: 'hash' };
        }
    }
}

// Usage example:
// const result = await ImageComparator.compareImages(photo1, photo2);
// console.log('Are photos the same?', result.isSame, result.confidence);