const AWS = require('aws-sdk');
const https = require('https');
const fs = require('fs');

AWS.config.update({
    region: process.env.REGION,
    accessKeyId: process.env.AWS_ID,
    secretAccessKey: process.env.AWS_SECRET
});
const rekognition = new AWS.Rekognition();

async function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

async function readLocalFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) reject(err);
            else resolve(data);
        });
    });
}

exports.compareFace = async (sourceBuffer, targetImage) => {
    try {
        let targetBuffer;
        if (Buffer.isBuffer(targetImage)) {
            targetBuffer = targetImage;
        } else if (typeof targetImage === 'string') {
            targetBuffer = targetImage.startsWith('http') ? await downloadImage(targetImage) : await readLocalFile(targetImage);
        } else {
            throw new Error('Target image must be a Buffer, URL, or file path');
        }

        const params = {
            SourceImage: { Bytes: sourceBuffer },
            TargetImage: { Bytes: targetBuffer },
            SimilarityThreshold: 70
        };

        const data = await rekognition.compareFaces(params).promise();
        console.log(data);
        if (data.FaceMatches && data.FaceMatches.length > 0) {
            return {
                matched: true,
                similarity: data.FaceMatches[0].Similarity,
                faceDetails: data.FaceMatches[0].Face
            };
        }
        return {
            matched: false,
            similarity: 0
        };

    } catch (err) {
        console.error('Rekognition error:', err);
        return { matched: false, similarity: 0 };
    }
}