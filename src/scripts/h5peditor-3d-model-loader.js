import ThreeDModelLoaderConversionDropzone from './h5peditor-3d-model-loader-conversion-dropzone.js';
import ThreeDModelLoaderPreview from './h5peditor-3d-model-loader-preview.js';

class ThreeDModelLoader {
  /**
   * Used to load additional GLTF resources
   * @class H5PEditor.ThreeDModelLoader
   *
   * @param {object} parent Parent object in semantics hierarchy.
   * @param {object} field Fields in semantics where widget is used.
   * @param {object} params Parameters of form.
   * @param {function} setValue Callback to update the form value.
   *
   * @throws {Error} No image found.
   */
  constructor(parent, field, params, setValue) {
    this.parent = parent;
    this.field = field;
    this.params = params;
    this.setValue = setValue;

    // Sanitize field parameters
    this.field.threeDModelLoader = this.field.threeDModelLoader || {};
    this.field.threeDModelLoader.fileTypeExtensions = this.field.threeDModelLoader.fileTypeExtensions || ['gltf', 'glb'];
    this.field.threeDModelLoader.geometryPath = this.field.threeDModelLoader.geometryPath || '';
    this.field.threeDModelLoader.planePatternPath = this.field.threeDModelLoader.planePatternPath || '';

    // IE11 can neither handle preview nor conversion
    this.canPreview = window.navigator.userAgent.indexOf('Trident/') === -1;
    this.canConvert = window.navigator.userAgent.indexOf('Trident/') === -1;

    this.queue = [];

    // Create the wrapper:
    this.$container = H5P.jQuery('<div>', {
      'class': 'field h5peditor-3d-model-loader-container'
    });

    const widgetName = this.field.type;
    this.fieldInstance = new H5PEditor.widgets[widgetName](parent, field, params, setValue);
    this.fieldInstance.appendTo(this.$container);

    // Errors
    this.$errors = this.$container.children().children('.h5p-errors');

    if (this.canPreview) {
      // Create preview
      this.preview = new ThreeDModelLoaderPreview(
        {
          plane: this.field.threeDModelLoader.planePatternPath !== ''
        },
        {
          onIframeComplete: (() => {
            // Potentially init stuff only now
          })
        });
      this.$container.get(0).appendChild(this.preview.getDOM());

      // Update scene plane for marker
      if (this.field.threeDModelLoader.planePatternPath) {
        const arMarker = H5PEditor.findField(this.field.threeDModelLoader.planePatternPath, this.parent);
        if (arMarker) {
          arMarker.on('removedMarkerPattern', () => {
            this.preview.setMarkerTexture();
          });

          arMarker.on('addedMarkerPattern', (event) => {
            this.preview.setMarkerTexture(event.data);
          });
        }
      }
    }

    this.parent.ready( () => {

      if (this.canConvert) {
        // Create dropzone
        this.dropzone = this.dropzone || new ThreeDModelLoaderConversionDropzone((result) => {
          this.handleConversionDone(result);
        });
        const container = this.$container.get(0);
        container.parentNode.insertBefore(this.dropzone.getDOM(), container.nextSibling);
      }

      // It might be better to have a complete geometry editor widget
      const geometryPath = this.field.threeDModelLoader.geometryPath;

      if (this.field.threeDModelLoader.geometryPath !== '') {
        // Listen for scale change
        this.rowScale = H5PEditor.findField(`${geometryPath}/scale`, this.parent);
        if (this.rowScale && this.canPreview) {
          this.rowScale.on('changed', (event) => {
            this.preview.setModelScale(
              parseFloat(event.data.scale) / 100
            );
          });
        }

        // Listen for position change
        this.rowPosition = H5PEditor.findField(`${geometryPath}/position`, this.parent);
        if (this.rowPosition && this.canPreview) {
          this.rowPosition.on('changed', (event) => {
            this.preview.setModelPosition({
              x: parseFloat(event.data.x),
              y: parseFloat(event.data.y),
              z: parseFloat(event.data.z)
            });
          });
        }

        // Listen for rotation change
        this.rowRotation = H5PEditor.findField(`${geometryPath}/rotation`, this.parent);
        if (this.rowRotation && this.canPreview) {
          this.rowRotation.on('changed', (event) => {
            this.preview.setModelRotation({
              x: parseFloat(event.data.x),
              y: parseFloat(event.data.y),
              z: parseFloat(event.data.z)
            });
          });
        }
      }
    });

    // Changes
    this.changes = [];

    this.fileIcon = document.createElement('div');
    this.fileIcon.classList.add('h5peditor-3d-model-loader-file-icon');

    // Update icon on loadup
    H5PEditor.followField(this.parent, this.field.name, (event) => {
      if (!event || !event.path) {
        this.resetModel();
        return;
      }

      // Only gltf supported
      const extension = event.path.split('.').pop().toLowerCase();
      if (this.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
        return;
      }

      this.setModel(event.path);
    });

    this.fieldInstance.on('uploadProgress', () => {
      if (this.canPreview) {
        this.preview.hide();
      }

      this.resetGeometry();
    });

    // React on file changes
    this.fieldInstance.changes.push((event) => {
      if (!event) {
        this.resetModel();
      }
      else {
        this.handleFileUploaded(event.path);
      }
    });
  }

  /**
   * Reset geometry.
   */
  resetGeometry() {
    [this.rowScale, this.rowPosition, this.rowRotation].forEach(row => {
      if (!row) {
        return;
      }

      row.children.forEach(child => {
        child.$input.val(child.field.default);
        child.$input.change();
      });
    });
  }

  /**
   * Reset model.
   */
  resetModel() {
    if (this.canPreview) {
      this.preview.setModel();
      this.preview.hide();
    }

    this.resetGeometry();
  }

  /**
   * Set model in preview.
   * @param {string} path Full URL path to model file.
   */
  setModel(path) {
    const extension = path.replace(/#tmp$/, '').split('.').pop().toLowerCase();

    this.showFileIcon(extension);

    if (this.canConvert) {
      this.dropzone.hide();
    }

    if (this.canPreview) {
      this.preview.setModel(path, this.getGeometry());
      this.preview.show();
    }
  }

  /**
   * Get current geometry.
   * @return {object} Geometry data.
   */
  getGeometry() {
    // Yes, you'd make sure the children are in place and number fields...
    return {
      scale: parseFloat(this.rowScale.children[0].$input.val()) / 100,
      position: {
        x: parseFloat(this.rowPosition.children[0].$input.val()),
        y: parseFloat(this.rowPosition.children[1].$input.val()),
        z: parseFloat(this.rowPosition.children[2].$input.val()),
      },
      rotation: {
        x: parseFloat(this.rowRotation.children[0].$input.val()),
        y: parseFloat(this.rowRotation.children[1].$input.val()),
        z: parseFloat(this.rowRotation.children[2].$input.val()),
      }
    };
  }

  /**
   * Handle new file uploaded.
   * @param {string} path Path to model.
   */
  handleFileUploaded(path) {
    const extension = path.split('#').slice(0, -1).join('#').split('.').slice(-1)[0].toLowerCase();

    // Only gltf supported
    if (this.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
      this.$errors.append(H5PEditor.createError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'filetypeNotSupported')));
      this.removeFile();

      if (this.canConvert) {
        this.dropzone.hide();
      }

      return;
    }

    /*
     * GLTF files are JSON files, but may not be in embedded format with base64
     * encoded textures or bin files. Would require to upload assets separately
     * and encode them. For now, only allow GLTF in embedded format and GLB.
     */
    if (extension === 'gltf') {
      // Get potential cross-origin source
      const element = document.createElement('div');
      H5P.setSource(element, {path: path}, H5PEditor.contentId);
      const src = element.src;

      // Try to parse JSON from file
      try {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', src);
        xhr.onreadystatechange = () => {
          if (xhr.readyState !== 4) {
            return;
          }

          try {
            const json = JSON.parse(xhr.responseText);

            // Three.JS cannot handle glTF v1.0.
            if (!this.isGLTFVersionTwo(json)) {
              this.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'onlyVersionTwo'));
              return;
            }

            // Can't upload multiple files or zip files, offer conversion
            if (!this.isGLTFEmbeddedFormat(json)) {
              if (this.canConvert) {
                this.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'onlyEmbeddedAssets'));
                this.handleEmbeddedAssets();
              }
              else {
                this.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'browserCannotConvert'));
              }

              return;
            }
          }
          catch (error) {
            this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged')} (${error})`);
            return;
          }

          this.setModel(path);
        };
        xhr.send();
      }
      catch (error) {
        this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged')} (${error})`);
        return;
      }
    }
    else {
      this.setModel(path);
    }
  }

  /**
   * Handle embedded assets uploaded.
   */
  handleEmbeddedAssets() {
    // Add dropzone to DOM
    if (this.canConvert) {
      this.dropzone.show();
    }
  }

  /**
   * Handle conversion done.
   * @param {object} result Result.
   * @param {object} [result.file] File data.
   * @param {string} [result.error] Error message.
   */
  handleConversionDone(result) {
    if (result.error) {
      this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'conversionError')} (${result.error})`);
      return;
    }

    // Hope all's sanitized here with the file
    this.fieldInstance.upload(result.file, 'foo.glb');

    if (this.canConvert) {
      this.dropzone.hide();
    }
  }

  /**
   * Check JSON of GLTF file for being embedded format.
   * @param {object} json GLTF file as JSON object.
   * @return {boolean} True, if is embedded format, else false.
   */
  isGLTFEmbeddedFormat(json) {
    const objects = this.findObjects(json, 'uri', '');
    const containsExternalReference = objects.some((obj) => {
      return obj.uri.substr(0, 5) !== 'data:';
    });

    return !containsExternalReference;
  }

  /**
   * Check JSON of GLTF file for version strings.
   * @param {object} json GLTF file as JSON object.
   * @return {boolean} True, if no version is of 1.0.
   */
  isGLTFVersionTwo(json) {
    const objects = this.findObjects(json, 'version', '');

    const containsOnePointO = objects.some((obj) => {
      return obj.version === '1.0';
    });

    return !containsOnePointO;
  }

  /**
   * Get objects with particular key (and value) from object.
   * @param {object} obj Object to search in.
   * @param {string} key Key to search for.
   * @param {string} val Value to search for.
   */
  findObjects(obj, key, val) {
    let objects = [];
    for (var i in obj) {
      if (!obj.hasOwnProperty(i)) {
        continue;
      }

      if (typeof obj[i] == 'object') {
        objects = objects.concat(this.findObjects(obj[i], key, val));
      }
      else {
        if (i === key && obj[i] === val || i === key && val === '') {
          objects.push(obj);
        }
        else if (obj[i] === val && key === '') {
          if (objects.lastIndexOf(obj) === -1) {
            objects.push(obj);
          }
        }
      }
    }

    return objects;
  }

  /**
   * Handle error.
   * @param {string} errorMessage Error message text.
   */
  handleError(errorMessage) {
    this.$errors.empty();
    this.$errors.append(H5PEditor.createError(errorMessage));
    this.removeFile();
  }

  /**
   * Remove file from widget.
   */
  removeFile() {
    delete this.fieldInstance.params;
    this.fieldInstance.setValue(this.fieldInstance.field);
    this.fieldInstance.addFile();

    for (var i = 0; i < this.fieldInstance.changes.length; i++) {
      this.fieldInstance.changes[i]();
    }
  }

  /**
   * Show file pseudo icon.
   * @param {string} type File type.
   */
  showFileIcon(type) {
    // Wait for image. File.addFile() might not have completed yet
    const waitForImg = (timeout) => {
      timeout = timeout || 500;

      if (timeout <= 0) {
        return;
      }

      const img = this.fieldInstance.$file.find('img').get(0);
      if (img) {
        this.fileIcon.title = type;
        this.fileIcon.innerText = type;
        img.style.display = 'none';
        this.fieldInstance.$file.find('.thumbnail').get(0).appendChild(this.fileIcon);
      }
      else {
        setTimeout(() => {
          waitForImg(timeout - 20);
        }, 20);
      }
    };

    waitForImg();
  }

  /**
   * Append field to wrapper. Invoked by H5P core.
   * @param {H5P.jQuery} $wrapper Wrapper.
   */
  appendTo($wrapper) {
    this.$container.appendTo($wrapper);
  }

  /**
   * Validate current values. Invoked by H5P core.
   * @return {boolean} True, if current value is valid, else false.
   */
  validate() {
    return this.fieldInstance.validate();
  }

  /**
   * Remove self. Invoked by H5P core.
   */
  remove() {
    this.$container.remove();
  }
}
export default ThreeDModelLoader;
