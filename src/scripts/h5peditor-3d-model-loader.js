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

    // Create the wrapper:
    this.$container = H5P.jQuery('<div>', {
      'class': 'field h5peditor-3d-model-loader-container'
    });

    const widgetName = this.field.type;
    this.fieldInstance = new H5PEditor.widgets[widgetName](parent, field, params, setValue);
    this.fieldInstance.appendTo(this.$container);

    // Errors
    this.$errors = this.$container.children().children('.h5p-errors');

    // Changes
    this.changes = [];

    this.fileIcon = document.createElement('div');
    this.fileIcon.classList.add('h5peditor-3d-model-loader-file-icon');

    // Update icon on loadup
    H5PEditor.followField(this.parent, this.field.name, (event) => {
      if (!event || !event.path) {
        return;
      }

      // Only gltf supported
      const extension = event.path.split('.').slice(-1)[0].toLowerCase();
      if (this.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
        return;
      }

      this.showFileIcon(extension);
    });

    this.fieldInstance.on('fileUploaded', (event) => {
      this.handleFileUploaded(event);
    });
  }

  /**
   * Handle new file uploaded.
   * @param {Event} event Event.
   */
  handleFileUploaded(event) {
    const extension = event.data.path.split('#').slice(0, -1).join('#').split('.').slice(-1)[0].toLowerCase();

    // Only gltf supported
    if (this.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
      this.$errors.append(H5PEditor.createError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'filetypeNotSupported')));
      this.removeFile();

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
      H5P.setSource(element, event.data, H5PEditor.contentId);
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
            if (!this.isGLTFEmbeddedFormat(json)) {
              this.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'onlyEmbeddedAssets'));
              return;
            }
          }
          catch (error) {
            this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged')} (${error})`);
            return;
          }

          this.showFileIcon(extension);
        };
        xhr.send();
      }
      catch (error) {
        this.handleError(`${H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged')} (${error})`);
        return;
      }
    }

    this.showFileIcon(extension);
  }

  /**
   * Check JSON of GLTF file for being embedded format.
   * @param {object} json GLTF file as JSON object.
   * @return {boolean} True, if is embedded format, else false.
   */
  isGLTFEmbeddedFormat(json) {
    /**
     * Get objects with particular key (and value) from object.
     * @param {object} obj Object to search in.
     * @param {string} key Key to search for.
     * @param {string} val Value to search for.
     */
    const getObjects = (obj, key, val) => {
      let objects = [];
      for (var i in obj) {
        if (!obj.hasOwnProperty(i)) {
          continue;
        }

        if (typeof obj[i] == 'object') {
          objects = objects.concat(getObjects(obj[i], key, val));
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
    };

    const objects = getObjects(json, 'uri', '');
    const containsExternalReference = objects.some((obj) => {
      return obj.uri.substr(0, 5) !== 'data:';
    });

    return !containsExternalReference;
  }

  /**
   * Handle error.
   * @param {string} errorMessage Error message text.
   */
  handleError(errorMessage) {
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
