/**
 * @class H5PEditor.ThreeDModelLoaderGLTF2GLB
 *
 * Based on makeglb by Saurabh Bhatia
 * https://github.com/sbtron/makeglb
 * The MIT License
 * Copyright (c) 2017 Saurabh Bhatia
 */

/** @constant {number} FILE_HEADER_BYTES File header size: magic + version + length. */
const FILE_HEADER_BYTES = 12;

/** @constant {number} JSON_CHUNK_HEADER_BYTES JSON chunk header size: json length + type. */
const JSON_CHUNK_HEADER_BYTES = 8;

/** @constant {number} BIN_CHUNK_HEADER_BYTES BIN chunk header size: chunk length + type. */
const BIN_CHUNK_HEADER_BYTES = 8;

/** @constant {number} GLB_HEADER_BYTES GLB header size. */
const GLB_HEADER_BYTES = 4;

/** @constant {number} BINARY_DATA_CHUNK_ID Binary data chunk ID. */
const BINARY_DATA_CHUNK_ID = 0x004E4942;

/** @constant {number} JSON_CHUNK_ID JSON chunk ID. */
const JSON_CHUNK_ID = 0x4E4F534A;

/** @constant {number} PADDING_BYTE_SPACE Padding byte. */
const PADDING_BYTE_SPACE = 0x20;

/** @constant {number} GLB_VERSION GLB version. */
const GLB_VERSION = 2;

export default class ThreeDModelLoaderGLTF2GLB {
  /**
   * Constructor.
   */
  constructor() {
    this.remainingFilesToProcess = 0;
    this.files = [];
    this.fileblobs = [];
    this.glbfilename;
    this.gltf;
    this.outputBuffers;
    this.bufferMap;
    this.bufferOffset;
    this.gltfMimeTypes = {
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
      'text/plain': ['glsl', 'vert', 'vs', 'frag', 'fs', 'txt'],
      'image/vnd-ms.dds': ['dds'],
    };
  }

  /**
   * Convert items to single glb file.
   * @param {object[]} items Items.
   * @param {function} callback Callback when done, will return file or error.
   */
  convert(items, callback) {
    if (!items || typeof callback !== 'function') {
      return;
    }

    this.callback = callback;

    this.remainingFilesToProcess = items.length;

    for (let i = 0; i < items.length; i++) {
      let entry;
      if (items[i].getAsEntry) {
        entry = items[i].getAsEntry();
      }
      else if (items[i].webkitGetAsEntry) {
        entry = items[i].webkitGetAsEntry();
      }

      if (entry) {
        if (entry.isFile) {
          callback({
            error: H5PEditor.t('H5PEditor.ThreeDModelLoader', 'notAFolder'),
          });
          return;
        }

        this.traverseFileTree(entry);
      }
    }
  }

  /**
   * Traverse all files in folder.
   * @param {object} item File or folder.
   * @param {string} path Current path.
   */
  traverseFileTree(item, path = '') {
    if (item.isFile) {
      item.file((file) => {
        this.files.push(file);

        const extension = file.name.split('.').pop();
        if (extension === 'gltf') {
          this.glbfilename = file.name.substr(file.name.lastIndexOf('/') + 1, file.name.lastIndexOf('.'));

          const reader = new FileReader();
          reader.readAsText(file);
          reader.onload = (event) => {
            this.gltf = JSON.parse(event.target.result);
            this.checkForDone();
          };
        }
        else {
          const reader = new FileReader();
          reader.onload = ((theFile) => {
            return (event) => {
              this.fileblobs[theFile.name.toLowerCase()] = event.target.result;
              this.checkForDone();
            };
          })(file);
          reader.readAsArrayBuffer(file);
        }
      }, (error) => {
        this.callback({ error: error });
      });
    }
    else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries((entries) => {
        this.remainingFilesToProcess += entries.length;
        this.checkForDone();
        for (let i = 0; i < entries.length; i++) {
          this.traverseFileTree(entries[i], `${path + item.name  }/`);
        }
      });
    }
  }

  /**
   * Check for being done.
   */
  checkForDone() {
    this.remainingFilesToProcess--;

    if (this.remainingFilesToProcess === 0) {
      this.outputBuffers = [];
      this.bufferMap = new Map();
      this.bufferOffset = 0;

      this.processBuffers()
        .then(() => {
          this.callback({
            file: this.buildOutputFile(),
          });
        })
        .catch((error) => {
          this.callback({
            error: error,
          });
        });
    }
  }

  /**
   * Process all buffers.
   * @returns {Promise} Result.
   */
  processBuffers() {
    if (!this.gltf) {
      return Promise.reject(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'noGLTFFound'));
    }

    const pendingBuffers = this.gltf.buffers.map((buffer, bufferIndex) => {
      return this.getDataFromUri(buffer)
        .then((data) => {
          if (data !== undefined) {
            this.outputBuffers.push(data);
          }

          delete buffer.uri;
          buffer.byteLength = data.byteLength;
          this.bufferMap.set(bufferIndex, this.bufferOffset);
          this.bufferOffset += this.getAlignedLength(data.byteLength);
        });
    });

    return Promise.all(pendingBuffers)
      .then(() => {
        let bufferIndex = this.gltf.buffers.length;
        const images = this.gltf.images || [];
        const pendingImages = images.map((image) => {
          return this.getDataFromUri(image).then((data) => {
            if (data === undefined) {
              delete image.uri;
              return;
            }

            var bufferView = {
              buffer: 0,
              byteOffset: this.bufferOffset,
              byteLength: data.byteLength,
            };

            this.bufferMap.set(bufferIndex, this.bufferOffset);
            bufferIndex++;
            this.bufferOffset += this.getAlignedLength(data.byteLength);

            const bufferViewIndex = this.gltf.bufferViews.length;
            this.gltf.bufferViews.push(bufferView);
            this.outputBuffers.push(data);
            image.bufferView = bufferViewIndex;
            image.mimeType = this.getMimeType(image.uri);
            delete image.uri;
          });
        });

        return Promise.all(pendingImages);
      });
  }

  /**
   * Build output file from buffer.
   * @returns {Blob} File blob.
   */
  buildOutputFile() {
    const Binary = {
      Magic: 0x46546C67,
    };

    for (let i = 0, a = this.gltf.bufferViews; i < a.length; i++) {
      const bufferView = a[i];
      if (bufferView.byteOffset === undefined) {
        bufferView.byteOffset = 0;
      }
      else {
        bufferView.byteOffset = bufferView.byteOffset + this.bufferMap.get(bufferView.buffer);
      }
      bufferView.buffer = 0;
    }

    const binBufferSize = this.bufferOffset;
    this.gltf.buffers = [{
      byteLength: binBufferSize,
    }];

    const enc = new TextEncoder();
    const jsonBuffer = enc.encode(JSON.stringify(this.gltf));
    const jsonAlignedLength = this.getAlignedLength(jsonBuffer.length);
    let padding;

    if (jsonAlignedLength !== jsonBuffer.length) {
      padding = jsonAlignedLength - jsonBuffer.length;
    }

    const totalSize =
      FILE_HEADER_BYTES +
      JSON_CHUNK_HEADER_BYTES +
      jsonAlignedLength +
      BIN_CHUNK_HEADER_BYTES +
      binBufferSize;

    const finalBuffer = new ArrayBuffer(totalSize);
    const dataView = new DataView(finalBuffer);

    let bufIndex = 0;
    dataView.setUint32(bufIndex, Binary.Magic, true);
    bufIndex += GLB_HEADER_BYTES;
    dataView.setUint32(bufIndex, GLB_VERSION, true);
    bufIndex += GLB_HEADER_BYTES;
    dataView.setUint32(bufIndex, totalSize, true);
    bufIndex += GLB_HEADER_BYTES;

    // JSON
    dataView.setUint32(bufIndex, jsonAlignedLength, true);
    bufIndex += GLB_HEADER_BYTES;
    dataView.setUint32(bufIndex, JSON_CHUNK_ID, true);
    bufIndex += GLB_HEADER_BYTES;

    for (let j = 0; j < jsonBuffer.length; j++) {
      dataView.setUint8(bufIndex, jsonBuffer[j]);
      bufIndex++;
    }

    if (padding !== undefined) {
      for (let j = 0; j < padding; j++) {
        dataView.setUint8(bufIndex, PADDING_BYTE_SPACE);
        bufIndex++;
      }
    }

    // BIN
    dataView.setUint32(bufIndex, binBufferSize, true);
    bufIndex += GLB_HEADER_BYTES;
    dataView.setUint32(bufIndex, BINARY_DATA_CHUNK_ID, true);
    bufIndex += GLB_HEADER_BYTES;

    for (let i = 0; i < this.outputBuffers.length; i++) {
      const bufoffset = bufIndex + this.bufferMap.get(i);
      const buf = new Uint8Array(this.outputBuffers[i]);
      let thisbufindex = bufoffset;
      for (let j = 0; j < buf.byteLength; j++) {
        dataView.setUint8(thisbufindex, buf[j]);
        thisbufindex++;
      }
    }

    return new Blob([finalBuffer], { type: 'model/json-binary' });
  }

  /**
   * Check for base64 encoding.
   * @param {string} uri URI to check for encoding.
   * @returns {boolean} True if URI is base64 encoded.
   */
  isBase64(uri) {
    if (!uri || typeof uri !== 'string') {
      return false;
    }

    return uri.startsWith('data:');
  }

  /**
   * Decode URI from base64 encoding.
   * @param {string} uri URI to decode.
   * @returns {Promise} Response.
   */
  decodeBase64(uri) {
    return fetch(uri).then((response) => response.arrayBuffer());
  }

  /**
   * Get data from buffer URI.
   * @param {object} buffer Buffer.
   * @returns {Promise} Result.
   */
  getDataFromUri(buffer) {
    if (buffer.uri === undefined) {
      return Promise.resolve();
    }
    else if (this.isBase64(buffer.uri)) {
      return this.decodeBase64(buffer.uri);
    }
    else {
      const filename = buffer.uri.substr(buffer.uri.lastIndexOf('/') + 1);
      return Promise.resolve(this.fileblobs[filename.toLowerCase()]);
    }
  }

  /**
   * Get aligned value.
   * @param {number} value Value.
   * @returns {number} Aligned value.
   */
  getAlignedLength(value) {
    if (value === 0) {
      return value;
    }

    const alignValue = 4;
    const multiple = value % alignValue;
    return (multiple === 0) ? value : value + (alignValue - multiple);
  }

  /**
   * Get MIME type.
   * @param {string} filename File name.
   * @returns {string} MIME type.
   */
  getMimeType(filename) {
    for (let mimeType in this.gltfMimeTypes) {
      for (let extensionIndex in this.gltfMimeTypes[mimeType]) {
        var extension = this.gltfMimeTypes[mimeType][extensionIndex];

        if (filename.toLowerCase().split('.').pop() === (`${extension}`)) {
          return mimeType;
        }
      }
    }

    return 'application/octet-stream';
  }
}
