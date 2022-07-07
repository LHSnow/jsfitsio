/*global Module, FS, ccall, _malloc, _free, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPF32, HEAPF64, setValue, getValue,  UTF8ToString getCFunc assert stackSave stackAlloc EmterpreterAsync stackRestore, stringToUTF8, writeArrayToMemory, NODEFS */

/* eslint-disable dot-notation */

// eslint-disable-next-line no-console

// get image from an already-opened virtual FITS file
// fits object contains fptr
Module["getFITSImage"] = function (fits, hdu, opts, handler) {
  let i, ofptr, tfptr, hptr, status, datalen, extnum, extname;
  let buf, bufptr, buflen, bufptr2;
  let slice, doerr, ctype1, xbin, columns, cubecol, allcols;
  let bitpix;
  let filter = null;
  let fptr = fits.fptr;
  let fopts = null;
  let bin = 1;
  let binMode = 0;
  const iopts = null;
  const cens = [0, 0];
  const dims = [0, 0];
  const bmode = function (x) {
    // deepscan-disable-next-line COMPARE_INCOMPATIBLE_TYPE_STRICTLY
    if (x && (x === 1 || x === "a")) {
      return 1;
    }
    return 0;
  };
  const unbmode = function (x) {
    // deepscan-disable-next-line COMPARE_INCOMPATIBLE_TYPE_STRICTLY
    if (x && (x === 1 || x === "a")) {
      return "a";
    }
    return "s";
  };
  // opts is optional
  opts = opts || {};
  // make sure we have valid vfile, opened by cfitsio
  if (!fptr) {
    Module["error"]("virtual FITS file is missing for getFITSImage()");
  }
  // are we changing extensions on an existing virtual file?
  if (typeof opts.extension === "string") {
    // look for extension with specified name
    hptr = _malloc(4);
    setValue(hptr, 0, "i32");
    ccall(
      "ffmnhd",
      null,
      ["number", "number", "string", "number", "number"],
      [fptr, -1, opts.extension, 0, hptr]
    );
    status = getValue(hptr, "i32");
    _free(hptr);
    Module["errchk"](status);
    // get type of extension (image or table)
    hptr = _malloc(8);
    setValue(hptr + 4, 0, "i32");
    ccall(
      "ffghdt",
      null,
      ["number", "number", "number"],
      [fptr, hptr, hptr + 4]
    );
    hdu.type = getValue(hptr, "i32");
    status = getValue(hptr + 4, "i32");
    _free(hptr);
    Module["errchk"](status);
  } else if (typeof opts.extension === "number") {
    // go to extension number
    hptr = _malloc(8);
    setValue(hptr + 4, 0, "i32");
    ccall(
      "ffmahd",
      null,
      ["number", "number", "number", "number"],
      [fptr, opts.extension + 1, hptr, hptr + 4]
    );
    hdu.type = getValue(hptr, "i32");
    status = getValue(hptr + 4, "i32");
    _free(hptr);
    Module["errchk"](status);
  }
  // get hdu type
  hptr = _malloc(8);
  setValue(hptr + 4, 0, "i32");
  ccall("ffghdt", null, ["number", "number", "number"], [fptr, hptr, hptr + 4]);
  hdu.type = getValue(hptr, "i32");
  _free(hptr);
  Module["errchk"](status);
  // get extension number and name (of original data)
  hptr = _malloc(4);
  ccall("ffghdn", null, ["number", "number"], [fptr, hptr]);
  extnum = getValue(hptr, "i32") - 1;
  _free(hptr);
  // try to get extname (ignore errors)
  hptr = _malloc(88);
  setValue(hptr + 84, 0, "i32");
  ccall(
    "ffgky",
    null,
    ["number", "number", "string", "number", "number", "number"],
    [fptr, 16, "EXTNAME", hptr, 0, hptr + 84]
  );
  status = getValue(hptr + 84, "i32");
  if (status === 0) {
    extname = UTF8ToString(hptr).replace(/^'/, "").replace(/'$/, "").trim();
  } else {
    extname = "";
  }
  _free(hptr);
  // pre-processing
  switch (hdu.type) {
    case 0:
      // image: nothing to do
      hdu.imtab = "image";
      ofptr = fptr;
      break;
    case 1:
    case 2:
      // ascii or binary tables: bin table to image
      hdu.imtab = "table";
      hdu.table = {};
      hptr = _malloc(28);
      if (opts.table) {
        if (opts.table.bitpix) {
          bitpix = opts.table.bitpix;
        }
        if (opts.table.filter) {
          filter = opts.table.filter;
        }
        if (opts.table.columns) {
          columns = opts.table.columns;
        }
        if (opts.table.cubecol) {
          cubecol = opts.table.cubecol;
        }
        if (opts.table.bin) {
          bin = opts.table.bin;
        }
        if (opts.table.binMode) {
          binMode = bmode(opts.table.binMode);
        }
        // backward compatibity with pre-v1.12 globals
        if (opts.table.nx) {
          dims[0] = opts.table.nx;
        }
        if (opts.table.ny) {
          dims[1] = opts.table.ny;
        }
        if (opts.table.cx) {
          cens[0] = opts.table.cx;
        }
        if (opts.table.cy) {
          cens[1] = opts.table.cy;
        }
        // global defaults from fits.options
        if (opts.table.xdim) {
          dims[0] = opts.table.xdim;
        }
        if (opts.table.ydim) {
          dims[1] = opts.table.ydim;
        }
        if (opts.table.xcen) {
          cens[0] = opts.table.xcen;
        }
        if (opts.table.ycen) {
          cens[1] = opts.table.ycen;
        }
      }
      // overridden by options passed in this call
      if (opts.xdim !== undefined) {
        dims[0] = opts.xdim;
      }
      if (opts.ydim !== undefined) {
        dims[1] = opts.ydim;
      }
      if (opts.xcen) {
        cens[0] = opts.xcen;
      }
      if (opts.ycen) {
        cens[1] = opts.ycen;
      }
      if (opts.bitpix) {
        bitpix = opts.bitpix;
      }
      if (opts.filter) {
        filter = opts.filter;
      }
      if (opts.columns) {
        columns = opts.columns;
      }
      if (opts.cubecol) {
        cubecol = opts.cubecol;
      }
      if (opts.bin) {
        bin = opts.bin;
      }
      if (opts.binMode) {
        binMode = bmode(opts.binMode);
      }
      setValue(hptr, dims[0], "i32");
      setValue(hptr + 4, dims[1], "i32");
      // use center to generate image
      setValue(hptr + 8, cens[0], "double");
      setValue(hptr + 16, cens[1], "double");
      // clear return status
      setValue(hptr + 24, 0, "i32");
      // filter an event file and generate an image
      doerr = false;
      // handle string bin, possibly containing explicit binMode
      if (typeof bin === "string") {
        if (bin.match(/[as]$/)) {
          binMode = bmode(bin.slice(-1));
        }
        bin = parseFloat(bin);
      }
      if (!bin) {
        bin = 1;
      }
      // columns: alt columns for binning and/or cube column
      if (columns) {
        allcols = columns;
      }
      if (cubecol) {
        if (!columns) {
          allcols = "X Y";
        }
        allcols += ` ${cubecol}`;
        if (opts.file) {
          fopts = `ofile=!${opts.file}`;
        }
      }
      if (bitpix) {
        if (fopts) {
          fopts += ",";
        } else {
          fopts = "";
        }
        fopts += `bitpix=${bitpix}`;
      }
      try {
        ofptr = ccall(
          "filterTableToImage",
          "number",
          [
            "number",
            "string",
            "string",
            "number",
            "number",
            "number",
            "string",
            "number",
          ],
          [fptr, filter, allcols, hptr, hptr + 8, bin, fopts, hptr + 24]
        );
      } catch (e) {
        doerr = true;
      }
      // return values
      hdu.table.xdim = getValue(hptr, "i32");
      hdu.table.ydim = getValue(hptr + 4, "i32");
      hdu.table.xcen = getValue(hptr + 8, "double");
      hdu.table.ycen = getValue(hptr + 16, "double");
      hdu.table.bin = bin;
      if (bitpix) {
        hdu.table.bitpix = bitpix;
      }
      hdu.table.filter = filter;
      hdu.table.columns = columns;
      status = getValue(hptr + 24, "i32");
      _free(hptr);
      Module["errchk"](status);
      if (!ofptr || doerr) {
        Module["error"]("can't convert table to image (image too large?)");
      }
      // try to get CTYPE1 to check for HEALPix (ignore errors)
      hptr = _malloc(88);
      setValue(hptr + 84, 0, "i32");
      ccall(
        "ffgky",
        null,
        ["number", "number", "string", "number", "number", "number"],
        [ofptr, 16, "CTYPE1", hptr, 0, hptr + 84]
      );
      status = getValue(hptr + 84, "i32");
      if (status === 0) {
        ctype1 = UTF8ToString(hptr).replace(/^'/, "").replace(/'$/, "").trim();
      }
      _free(hptr);
      if (!ctype1 || !ctype1.match(/--HPX/i)) {
        // if we don't have a HEALPix image, we clear cens and dims
        // to extract at center of resulting image (below)
        delete opts.xcen;
        delete opts.ycen;
        delete opts.bin;
        // if dims were specified, clear them to read full image section
        if (opts.xdim !== undefined) {
          opts.xdim = 0;
        }
        if (opts.ydim !== undefined) {
          opts.ydim = 0;
        }
        // reset dim and cen values
        dims[0] = 0;
        dims[1] = 0;
        cens[0] = 0;
        cens[1] = 0;
        bin = 1;
      }
      break;
  }
  if (opts.image) {
    // backward-compatibility with pre-v1.12
    if (opts.image.xmax) {
      dims[0] = opts.image.xmax;
    }
    if (opts.image.ymax) {
      dims[1] = opts.image.ymax;
    }
    // global defaults from fits.options
    if (opts.image.xdim !== undefined) {
      dims[0] = opts.image.xdim;
    }
    if (opts.image.ydim !== undefined) {
      dims[1] = opts.image.ydim;
    }
  }
  // overridden by options passed in this call
  if (opts.bin) {
    bin = opts.bin;
  }
  if (opts.binMode) {
    binMode = bmode(opts.binMode);
  }
  if (opts.xdim !== undefined) {
    dims[0] = opts.xdim;
  }
  if (opts.ydim !== undefined) {
    dims[1] = opts.ydim;
  }
  if (opts.xcen) {
    cens[0] = opts.xcen;
  }
  if (opts.ycen) {
    cens[1] = opts.ycen;
  }
  // limits on image section
  hptr = _malloc(64);
  setValue(hptr, dims[0], "i32");
  setValue(hptr + 4, dims[1], "i32");
  setValue(hptr + 8, cens[0], "double");
  setValue(hptr + 16, cens[1], "double");
  // clear return status
  setValue(hptr + 60, 0, "i32");
  // might want a slice
  slice = opts.slice || "";
  // get array from image file
  doerr = false;
  // handle string bin, possibly containing explicit binMode
  if (typeof bin === "string") {
    if (bin.match(/[as]$/)) {
      binMode = bmode(bin.slice(-1));
    }
    bin = parseFloat(bin);
  }
  // final check on a valid bin
  if (!bin) {
    bin = 1;
  }
  try {
    bufptr = ccall(
      "getImageToArray",
      "number",
      [
        "number",
        "number",
        "number",
        "number",
        "number",
        "string",
        "string",
        "number",
        "number",
        "number",
        "number",
      ],
      [
        ofptr,
        hptr,
        hptr + 8,
        bin,
        binMode,
        slice,
        iopts,
        hptr + 24,
        hptr + 40,
        hptr + 56,
        hptr + 60,
      ]
    );
  } catch (e) {
    doerr = true;
  }
  // return the section values so caller can update LTM/LTV
  // we don't want to update the FITS file itself, since it hasn't changed
  hdu.bin = bin;
  hdu.binMode = unbmode(binMode);
  xbin = bin > 0 ? bin : 1 / Math.abs(bin);
  // nb: return start, end arrays are 4 ints wide, we only use the first two
  hdu.x1 = getValue(hptr + 24, "i32");
  hdu.y1 = getValue(hptr + 28, "i32");
  hdu.x2 = getValue(hptr + 40, "i32");
  hdu.y2 = getValue(hptr + 44, "i32");
  hdu.naxis1 = Math.floor((hdu.x2 - hdu.x1 + 1) / xbin);
  hdu.naxis2 = Math.floor((hdu.y2 - hdu.y1 + 1) / xbin);
  hdu.bitpix = getValue(hptr + 56, "i32");
  // pass along filter, even if we did not use it
  if (opts.filter) {
    hdu.filter = opts.filter;
  }
  // pass back slice we used
  if (slice) {
    hdu.slice = slice;
  }
  status = getValue(hptr + 60, "i32");
  _free(hptr);
  Module["errchk"](status);
  if (!bufptr || doerr) {
    Module["error"]("can't convert image to array (image too large?)");
  }
  // save pointer to section data
  datalen = hdu.naxis1 * hdu.naxis2;
  // for the need to wrap the subarray() call in new Uint8Array(), see:
  // https://github.com/emscripten-core/emscripten/issues/6747
  switch (hdu.bitpix) {
    case 8:
      hdu.image = new Uint8Array(HEAPU8.subarray(bufptr, bufptr + datalen));
      break;
    case 16:
      hdu.image = new Int16Array(
        HEAP16.subarray(bufptr / 2, bufptr / 2 + datalen)
      );
      break;
    case -16:
      hdu.image = new Uint16Array(
        HEAPU16.subarray(bufptr / 2, bufptr / 2 + datalen)
      );
      break;
    case 32:
      hdu.image = new Int32Array(
        HEAP32.subarray(bufptr / 4, bufptr / 4 + datalen)
      );
      break;
    case -32:
      hdu.image = new Float32Array(
        HEAPF32.subarray(bufptr / 4, bufptr / 4 + datalen)
      );
      break;
    case -64:
      hdu.image = new Float64Array(
        HEAPF64.subarray(bufptr / 8, bufptr / 8 + datalen)
      );
      break;
    default:
      Module["error"](`${hdu.bitpix}-bit FITS data is not supported`);
      break;
  }
  // get section header cards as a string
  hptr = _malloc(20);
  setValue(hptr + 12, 0, "i32");
  ccall(
    "getHeaderToString",
    null,
    ["number", "number", "number", "number"],
    [ofptr, hptr, hptr + 8, hptr + 12]
  );
  hdu.ncard = getValue(hptr + 8, "i32");
  bufptr2 = getValue(hptr, "*");
  // for the need to wrap the subarray() call in new Uint8Array(), see:
  // https://github.com/emscripten-core/emscripten/issues/6747
  buf = new Uint8Array(HEAPU8.subarray(bufptr2, bufptr2 + hdu.ncard * 80));
  buflen = buf.byteLength;
  hdu.cardstr = "";
  for (i = 0; i < buflen; i++) {
    hdu.cardstr += String.fromCharCode(buf[i]);
  }
  // free string allocated in getHeaderToString()
  setValue(hptr + 16, 0, "i32");
  ccall("fffree", null, ["number", "number"], [bufptr2, hptr + 16]);
  // ignore error on free
  // status  = getValue(hptr+16, "i32");
  // Module["errchk"](status);
  // this is the returned status from getHeaderToString()
  status = getValue(hptr + 12, "i32");
  _free(hptr);
  // error check on getHeaderToString()
  Module["errchk"](status);
  // cubecol => image with a new fptr ...
  if (cubecol) {
    // which either replaces orig, or is returned w/o closing the orig
    if (opts.separate) {
      fptr = ofptr;
    } else {
      tfptr = fptr;
      fptr = ofptr;
      ofptr = tfptr;
    }
    // table has become an image
    hdu.imtab = "image";
    // so we don't want the table object
    delete hdu.table;
    // the file is the vfile
    hdu.vfile = opts.file;
    // not the external file
    hdu.file = null;
  } else if (opts.file) {
    // set file name, if possible
    hdu.file = opts.file;
  }
  // close the image section "file"
  if (ofptr && ofptr !== fptr) {
    hptr = _malloc(4);
    setValue(hptr, 0, "i32");
    ccall("closeFITSFile", null, ["number", "number"], [ofptr, hptr]);
    status = getValue(hptr, "i32");
    _free(hptr);
    Module["errchk"](status);
  }
  // make up the return fits object
  hdu.fits = {
    fptr: fptr,
    vfile: hdu.vfile,
    heap: bufptr,
    cardstr: hdu.cardstr,
    extnum: extnum,
    extname: extname,
  };
  // having extracted a section, remove these to avoid their reuse
  delete opts.xcen;
  delete opts.ycen;
  delete opts.xdim;
  delete opts.ydim;
  delete opts.bin;
  // call the handler
  if (handler) {
    handler(hdu, opts);
  } else {
    Module["error"]("no handler specified for this FITS file");
  }
};

// read a blob as a FITS file
// open an existing virtual FITS file (e.g. created by Montage reprojection)
Module["handleFITSFile"] = function (fits, opts, handler) {
  let fptr, hptr, status, fileReader, filename, earr;
  let extn = "";
  let oopts = null;
  const hdu = {};
  // opts is optional
  opts = opts || {};
  handler = handler || Module["options"].handler;
  // blob: turn blob into virtual file, the open with cfitsio
  if (fits instanceof Blob) {
    // convert blob into array
    fileReader = new FileReader();
    fileReader.onload = function () {
      let fitsname, arr;
      // eslint-disable-next-line no-unused-vars
      let narr;
      // file name might be in the blob itself
      if (!opts.file && fits.name) {
        opts.file = fits.name;
      }
      // filename or assume gzip'ed: cfitsio will do the right thing ...
      if (opts.file) {
        // filename without slashes (don'twant to make subdirs)
        filename = opts.file
          .replace(/^\.\./, "")
          .replace(/^\./, "")
          .replace(/\//g, "_");
        // cfitsio extension
        earr = filename.match(/\[.*\]/);
        if (earr && earr[0]) {
          extn = earr[0];
        }
        //  we create as a virtual file without the extension
        hdu.vfile = filename.replace(/\[.*\]/g, "").replace(/[\s()]/g, "");
        //  fitsname with extension is what cfitio opens
        fitsname = hdu.vfile + extn;
      } else {
        fitsname = "myblob.gz";
        hdu.vfile = fitsname;
      }
      // delete old version, ignoring errors
      // safety check: leave files in subdirs (they're real, local files)
      if (hdu.vfile && hdu.vfile.indexOf("/") < 0) {
        Module["vunlink"](hdu.vfile);
      }
      // create a file in the emscripten virtual file system from the blob
      arr = new Uint8Array(fileReader.result);
      // make a virtual file
      if (arr[0] === 0x1f && arr[1] === 0x8b) {
        // if original is gzip'ed, unzip to virtual file
        hdu.vfile = `gz::${hdu.vfile.replace(/\.gz/, "")}`;
        fitsname = `gz::${fitsname.replace(/\.gz/, "")}`;
        try {
          narr = Module["gzdecompress"](arr, hdu.vfile, false);
        } catch (e) {
          Module["error"](`can't gunzip to virtual file: ${hdu.vfile}`);
        }
      } else if (arr[0] === 0x42 && arr[1] === 0x5a && arr[2] === 0x68) {
        // if original is bzip2'ed, bunzip2 to virtual file
        hdu.vfile = `bz::${hdu.vfile.replace(/\.bz2/, "")}`;
        fitsname = `bz::${fitsname.replace(/\.bz2/, "")}`;
        try {
          narr = Module["bz2decompress"](arr, hdu.vfile, false);
        } catch (e) {
          Module["error"](`can't bunzip2 to virtual file: ${hdu.vfile}`);
        }
      } else {
        // regular file to virtual file
        try {
          Module["vfile"](hdu.vfile, arr, false);
        } catch (e) {
          Module["error"](`can't create virtual file: ${hdu.vfile}`);
        }
      }
      // open the virtual file as a FITS file
      hptr = _malloc(8);
      setValue(hptr + 4, 0, "i32");
      fptr = ccall(
        "openFITSFile",
        "number",
        ["string", "number", "string", "string", "number", "number"],
        [fitsname, 0, opts.extlist, oopts, hptr, hptr + 4]
      );
      hdu.type = getValue(hptr, "i32");
      status = getValue(hptr + 4, "i32");
      _free(hptr);
      Module["errchk"](status);
      // save current extension number
      hptr = _malloc(4);
      ccall("ffghdn", null, ["number", "number"], [fptr, hptr]);
      hdu.extnum = getValue(hptr, "i32") - 1;
      _free(hptr);
      // extract image section and call handler
      Module["getFITSImage"]({ fptr: fptr }, hdu, opts, handler);
      // hints to the GC; for problems with fileReaders and GC, see:
      //http://stackoverflow.com/questions/32102361/filereader-memory-leak
      // this seems to make a difference:
      delete fileReader.result;
      // but these don't seem to have any effect:
      arr = null;
      // eslint-disable-next-line no-unused-vars
      narr = null;
    };
    // eslint-disable-next-line no-unused-vars
    fileReader.onerror = function (e) {
      Module["error"]("fileReader could not read blob as a FITS file", e);
    };
    // eslint-disable-next-line no-unused-vars
    fileReader.onabort = function (e) {
      Module["error"]("fileReader did not read blob as a FITS file", e);
    };
    // this starts it all!
    fileReader.readAsArrayBuffer(fits);
  } else if (typeof fits === "string") {
    // open existing virtual or local file as a FITS file
    if (!fits) {
      Module["error"]("FITS file name not specified");
    }
    hdu.vfile = opts.vfile || fits;
    hptr = _malloc(8);
    setValue(hptr + 4, 0, "i32");
    fptr = ccall(
      "openFITSFile",
      "number",
      ["string", "number", "string", "string", "number", "number"],
      [hdu.vfile, 0, opts.extlist, oopts, hptr, hptr + 4]
    );
    hdu.type = getValue(hptr, "i32");
    status = getValue(hptr + 4, "i32");
    _free(hptr);
    Module["errchk"](status);
    // extract image section and call handler
    Module["getFITSImage"]({ fptr: fptr }, hdu, opts, handler);
  } else {
    Module["error"]("invalid fits input for handleFITSFile");
  }
};

Module["cleanupFITSFile"] = function (fits, all) {
  let hptr;
  // let status;
  // sanity check
  if (!fits) {
    return;
  }
  // free up heap space from image section
  if (fits.heap) {
    _free(fits.heap);
    fits.heap = null;
  }
  if (all) {
    // close FITS file
    if (fits.fptr) {
      hptr = _malloc(4);
      setValue(hptr, 0, "i32");
      ccall("closeFITSFile", null, ["number", "number"], [fits.fptr, hptr]);
      // status  = getValue(hptr, "i32");
      _free(hptr);
      // Module["errchk"](status);
      fits.fptr = null;
    }
    // delete virtual FITS file
    // safety check: leave files in subdirs (they're real, local files)
    if (fits.vfile && fits.vfile.indexOf("/") < 0) {
      Module["vunlink"](fits.vfile);
    }
  }
};

// set the amount of max memory for a FITS image
Module["maxFITSMemory"] = function (bytes) {
  bytes = bytes || 0;
  return ccall("maxFITSMemory", "number", ["number"], [bytes]);
};

Module["options"] = { library: "cfitsio" };
