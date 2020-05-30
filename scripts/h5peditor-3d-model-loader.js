/**
 * GLTF Loader widget module
 *
 * @param {H5P.jQuery} $
 */
H5PEditor.widgets.threeDModelLoader = H5PEditor.ThreeDModelLoader = (function ($) {
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
  function ThreeDModelLoader(parent, field, params, setValue) {
    const that = this;

    this.parent = parent;
    this.field = field;
    this.params = params;
    this.setValue = setValue;

    // Sanitize field parameters
    this.field.threeDModelLoader = this.field.threeDModelLoader || {};
    this.field.threeDModelLoader.fileTypeExtensions = this.field.threeDModelLoader.fileTypeExtensions || ['gltf', 'glb'];

    // Create the wrapper:
    this.$container = $('<div>', {
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
    H5PEditor.followField(this.parent, this.field.name, function (event) {
      if (!event || !event.path) {
        return;
      }

      // Only gltf supported
      const extension = event.path.split('.').slice(-1)[0].toLowerCase();
      if (that.field.threeDModelLoader.fileTypeExtensions.indexOf(extension) === -1) {
        return;
      }

      that.showFileIcon(extension);
    });

    this.fieldInstance.on('fileUploaded', function (event) {
      that.handleFileUploaded(event);
    });
  }

  /**
   * Handle new file uploaded.
   * @param {Event} event Event.
   */
  ThreeDModelLoader.prototype.handleFileUploaded = function (event) {
    const that = this;

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
        xhr.onreadystatechange = function () {
          if (xhr.readyState !== 4) {
            return;
          }

          try {
            const json = JSON.parse(xhr.responseText);
            if (!that.isGLTFEmbeddedFormat(json)) {
              that.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'onlyEmbeddedAssets'));
              return;
            }
          }
          catch (error) {
            that.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged'), '(' + error + ')');
            return;
          }

          const json = JSON.parse(xhr.responseText);
          if (!that.isGLTFEmbeddedFormat(json)) {
            that.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'onlyEmbeddedAssets'));
            return;
          }

          that.showFileIcon(extension);
        };
        xhr.send();
      }
      catch (error) {
        this.handleError(H5PEditor.t('H5PEditor.ThreeDModelLoader', 'fileDamaged'), '(' + error + ')');
        return;
      }
    }

    this.showFileIcon(extension);
  };

  /**
   * Check JSON of GLTF file for being embedded format.
   * @param {object} json GLTF file as JSON object.
   * @return {boolean} True, if is embedded format, else false.
   */
  ThreeDModelLoader.prototype.isGLTFEmbeddedFormat = function (json) {
    /**
     * Get objects with particular key (and value) from object.
     * @param {object} obj Object to search in.
     * @param {string} key Key to search for.
     * @param {string} val Value to search for.
     */
    function getObjects(obj, key, val) {
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
    }

    const objects = getObjects(json, 'uri', '');
    const containsExternalReference = objects.some(function (obj) {
      return obj.uri.substr(0, 5) !== 'data:';
    });

    return !containsExternalReference;
  };

  /**
   * Handle error.
   * @param {string} errorMessage Error message text.
   */
  ThreeDModelLoader.prototype.handleError = function (errorMessage) {
    this.$errors.append(H5PEditor.createError(errorMessage));
    this.removeFile();
  };

  /**
   * Remove file from widget.
   */
  ThreeDModelLoader.prototype.removeFile = function () {
    delete this.fieldInstance.params;
    this.fieldInstance.setValue(this.fieldInstance.field);
    this.fieldInstance.addFile();

    for (var i = 0; i < this.fieldInstance.changes.length; i++) {
      this.fieldInstance.changes[i]();
    }
  };

  /**
   * Show file pseudo icon.
   * @param {string} type File type.
   */
  ThreeDModelLoader.prototype.showFileIcon = function (type) {
    const that = this;

    // Wait for image. File.addFile() might not have completed yet
    const waitForImg = function (timeout) {
      timeout = timeout || 500;

      if (timeout <= 0) {
        return;
      }

      const img = that.fieldInstance.$file.find('img');
      if (img.length > 0) {
        that.fileIcon.title = type;
        that.fileIcon.innerText = type;
        that.fieldInstance.$file.find('img').css('display', 'none');
        that.fieldInstance.$file.find('.thumbnail').append(that.fileIcon);
      }
      else {
        setTimeout(function () {
          waitForImg(timeout - 20);
        }, 20);
      }
    };

    waitForImg();
  };

  /**
   * Append field to wrapper. Invoked by H5P core.
   * @param {H5P.jQuery} $wrapper Wrapper.
   */
  ThreeDModelLoader.prototype.appendTo = function ($wrapper) {
    this.$container.appendTo($wrapper);
  };

  /**
   * Validate current values. Invoked by H5P core.
   * @return {boolean} True, if current value is valid, else false.
   */
  ThreeDModelLoader.prototype.validate = function () {
    return this.fieldInstance.validate();
  };

  /**
   * Remove self. Invoked by H5P core.
   */
  ThreeDModelLoader.prototype.remove = function () {
    this.$container.remove();
  };

  return ThreeDModelLoader;
})(H5P.jQuery);
