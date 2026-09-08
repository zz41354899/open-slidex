"use strict";

function imageSize() {
  throw new TypeError(
    "OpenSlideX disables PptxGenJS automatic image-size parsing; provide explicit image dimensions."
  );
}

function noop() {}

module.exports = imageSize;
module.exports.default = imageSize;
module.exports.imageSize = imageSize;
module.exports.disableFS = noop;
module.exports.disableTypes = noop;
module.exports.setConcurrency = noop;
module.exports.types = [];
