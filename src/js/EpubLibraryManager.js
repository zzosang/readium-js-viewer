define(['jquery', './ModuleConfig', './PackageParser', './workers/WorkerProxy', 'StorageManager', 'i18nStrings'], function ($, moduleConfig, PackageParser, WorkerProxy, StorageManager, Strings) {

	var LibraryManager = function(){
	};

	var adjustEpubLibraryPath = function(path) {

				if (!path || !moduleConfig.epubLibraryPath) return path;

				if (path.indexOf("epub_content/") == 0) {
						path = path.replace("epub_content/", "");
				}

				var parts = moduleConfig.epubLibraryPath.split('/');
				parts.pop();

				var root = parts.join('/');
				path = root + (path.charAt(0) == '/' ? '' : '/') + path;

				return path;
	};

	LibraryManager.prototype = {

	   _getFullUrl : function(packageUrl, relativeUrl){
            if (!relativeUrl){
                return null;
            }

            var parts = packageUrl.split('/');
            parts.pop();

            var root = parts.join('/');

            return root + (relativeUrl.charAt(0) == '/' ? '' : '/') + relativeUrl
        },

        retrieveAvailableEpubs : function(success, error){
            if (this.libraryData){
                success(this.libraryData);
                return;
            }

		        var indexUrl = moduleConfig.epubLibraryPath
														? StorageManager.getPathUrl(moduleConfig.epubLibraryPath)
														: StorageManager.getPathUrl('/epub_library.json');

            var self = this;
						$.getJSON(indexUrl, function(data){

								if (moduleConfig.epubLibraryPath) {
										for (var i = 0; i < data.length; i++) {
												data[i].coverHref = adjustEpubLibraryPath(data[i].coverHref);
												data[i].rootUrl = adjustEpubLibraryPath(data[i].rootUrl);
										}
								}

			          self.libraryData = data;
								success(data);
						}).fail(function(){
                self.libraryData = [];
                success([]);
            });
		},

        deleteEpubWithId : function(id, success, error){
            WorkerProxy.deleteEpub(id, this.libraryData, {
                success: this._refreshLibraryFromWorker.bind(this, success),
                error: error
            });
        },
		retrieveFullEpubDetails : function(packageUrl, rootUrl, rootDir, noCoverBackground, success, error){
            var self = this;

						$.get(packageUrl, function(data){

	                if(typeof(data) === "string" ) {
	                    var parser = new window.DOMParser;
	                    data = parser.parseFromString(data, 'text/xml');
	                }
	                var jsonObj = PackageParser.parsePackageDom(data, packageUrl);
	                jsonObj.coverHref = jsonObj.coverHref ? self._getFullUrl(packageUrl, jsonObj.coverHref) : undefined;
	                jsonObj.packageUrl = packageUrl;
	                jsonObj.rootDir = rootDir;
	                jsonObj.rootUrl = rootUrl;
	                jsonObj.noCoverBackground = noCoverBackground;

	                success(jsonObj);

						}).fail(error);
				},
        _refreshLibraryFromWorker : function(callback, newLibraryData){
            this.libraryData = newLibraryData;
            callback();
        },
        handleZippedEpub : function(options){
            WorkerProxy.importZip(options.file, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
            //Dialogs.showModalProgress()
            //unzipper.extractAll();
        },
        handleDirectoryImport : function(options){

            var rawFiles = options.files,
                files = {};
            for (var i = 0; i < rawFiles.length; i++){
                 var path = rawFiles[i].webkitRelativePath
                // don't capture paths that contain . at the beginning of a file or dir.
                // These are hidden files. I don't think chrome will ever reference
                // a file using double dot "/.." so this should be safe
                if (path.indexOf('/.') != -1){
                    continue;
                }
                var parts = path.split('/');

                parts.shift();
                var shiftPath = parts.join('/');

                files[shiftPath] = rawFiles[i];
            }

            WorkerProxy.importDirectory(files, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
        },
        handleUrlImport : function(options){
            WorkerProxy.importUrl(options.url, this.libraryData, {
                progress : options.progress,
                overwrite: options.overwrite,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error

            });
        },
        handleMigration : function(options){
            WorkerProxy.migrateOldBooks({
                progress : options.progress,
                success: this._refreshLibraryFromWorker.bind(this, options.success),
                error : options.error
            });
        },
        handleUrl : function(options){

        },
        canHandleUrl : function(){
            return moduleConfig.canHandleUrl;
        },
        canHandleDirectory : function(){
            return moduleConfig.canHandleDirectory;
        }
	}

    window.cleanEntireLibrary = function(){
        StorageManager.deleteFile('/', function(){
            console.log('done');
        }, console.error);
    }
	return new LibraryManager();

});
