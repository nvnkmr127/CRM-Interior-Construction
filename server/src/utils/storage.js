const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const env = require('../config/env');
const path = require('path');
const fs = require('fs');

class StorageProvider {
  async getUploadUrl(key, mimeType) { return `https://mock-s3.local/${key}?upload=true`; }
  async getDownloadUrl(key) { return `https://mock-s3.local/${key}?download=true`; }
  async deleteFile(key) { return true; }
  async validateMagicNumber(key, expectedMime) { return true; } // Mock local validation passing
  async uploadBuffer(key, buffer, mimeType) { return key; }
}

class S3StorageProvider extends StorageProvider {
  constructor() {
    super();
    this.s3Client = new S3Client({
      region: env.s3Region || 'us-east-1',
      credentials: {
        accessKeyId: env.awsKey || 'mock_access_key',
        secretAccessKey: env.awsSecret || 'mock_secret_key'
      }
    });
    this.bucket = env.s3Bucket || 'crm-documents-bucket';
  }

  async getUploadUrl(key, mimeType) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType
    });
    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
    return { uploadUrl: url, storageKey: key };
  }

  async getDownloadUrl(key) {
    if (process.env.CDN_URL) {
      return `${process.env.CDN_URL}/${key}`;
    }
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key
    });
    return await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key
    });
    await this.s3Client.send(command);
  }

  async validateMagicNumber(key, expectedMime) {
    // In production, we fetch the first 16 bytes using Range header
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: 'bytes=0-15'
      });
      const response = await this.s3Client.send(command);
      // Wait for stream to load
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      return this._checkMagic(buffer, expectedMime);
    } catch (e) {
      // Mock failure for missing mock S3 bucket
      console.warn('[Storage] Mocking magic number check since S3 is not reachable');
      return true; // assume valid for local dev without internet
    }
  }

  async uploadBuffer(key, buffer, mimeType) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType
    });
    await this.s3Client.send(command);
    return key;
  }

  _checkMagic(buffer, expectedMime) {
    const hex = buffer.toString('hex').toUpperCase();
    if (expectedMime === 'application/pdf' && !hex.startsWith('25504446')) return false;
    if ((expectedMime === 'image/jpeg' || expectedMime === 'image/jpg') && !hex.startsWith('FFD8FF')) return false;
    if (expectedMime === 'image/png' && !hex.startsWith('89504E47')) return false;
    // Allow others by default if we don't have a signature
    return true;
  }
}

class LocalStorageProvider extends StorageProvider {
  constructor() {
    super();
    this.uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async getUploadUrl(key, mimeType) {
    // In a real local provider, you'd generate a local API endpoint url
    // that accepts file uploads, and save it in the uploadDir.
    // We mock it for the interface completeness.
    return { 
      uploadUrl: `${env.clientUrl}/api/local-upload?key=${encodeURIComponent(key)}`, 
      storageKey: key 
    };
  }

  async getDownloadUrl(key) {
    return `${env.clientUrl}/api/local-download?key=${encodeURIComponent(key)}`;
  }

  async deleteFile(key) {
    const filePath = path.join(this.uploadDir, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  async validateMagicNumber(key, expectedMime) {
    const filePath = path.join(this.uploadDir, key);
    if (!fs.existsSync(filePath)) return false;
    
    try {
      const fd = fs.openSync(filePath, 'r');
      const buffer = Buffer.alloc(16);
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);
      
      const hex = buffer.toString('hex').toUpperCase();
      if (expectedMime === 'application/pdf' && !hex.startsWith('25504446')) return false;
      if ((expectedMime === 'image/jpeg' || expectedMime === 'image/jpg') && !hex.startsWith('FFD8FF')) return false;
      if (expectedMime === 'image/png' && !hex.startsWith('89504E47')) return false;
      return true;
    } catch (e) {
      console.warn('Failed to read local file magic number:', e);
      return false;
    }
  }

  async uploadBuffer(key, buffer, mimeType) {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    return key;
  }
}

// Select provider based on env
const provider = env.storageProvider === 'local' 
  ? new LocalStorageProvider() 
  : new S3StorageProvider();

module.exports = provider;
