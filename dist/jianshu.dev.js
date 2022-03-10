"use strict";

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

var axios = require("axios");

var fs = require("fs");

var cookie = '_ga=GA1.2.2076303826.1598800911; UM_distinctid=17c4af57c6e91f-05e70d0dbd3e59-b7a1b38-240000-17c4af57c6f99d; _gid=GA1.2.1481079163.1646707034; web_login_version=MTY0NjgxMTI1MA%3D%3D--9059aa6ded7c222abade15c9f021a99db01643da; remember_user_token=W1syNDEyMTIyN10sIiQyYSQxMSRXMm5SSUVEVXVCWnouLktHT2F6YXRlIiwiMTY0Njg4MTY3MC44MDY2MjM3Il0%3D--46db67649a78caed4cf907f3eb56a3cab7eb766d; read_mode=day; default_font=font2; locale=zh-CN; _m7e_session_core=4f0b65ced6ae297de9640860611f516f; CNZZDATA1279807957=629062401-1633335588-https%253A%252F%252Fwww.baidu.com%252F%7C1646877797; Hm_lvt_0c0e9d9b1e7d617b3e6842e85b9fb068=1646811167,1646811577,1646814537,1646881709; sensorsdata2015jssdkcross=%7B%22distinct_id%22%3A%221743ff5db5da06-08900fe1a69cee-3323766-2359296-1743ff5db5e38f%22%2C%22first_id%22%3A%22%22%2C%22props%22%3A%7B%22%24latest_traffic_source_type%22%3A%22%E7%9B%B4%E6%8E%A5%E6%B5%81%E9%87%8F%22%2C%22%24latest_search_keyword%22%3A%22%E6%9C%AA%E5%8F%96%E5%88%B0%E5%80%BC_%E7%9B%B4%E6%8E%A5%E6%89%93%E5%BC%80%22%2C%22%24latest_referrer%22%3A%22%22%7D%2C%22%24device_id%22%3A%221743ff5db5da06-08900fe1a69cee-3323766-2359296-1743ff5db5e38f%22%7D; Hm_lpvt_0c0e9d9b1e7d617b3e6842e85b9fb068=1646882763';

var contentURL = function contentURL(articleID) {
  return "https://www.jianshu.com/author/notes/".concat(articleID, "/content");
};

var articleListURL = function articleListURL(noteID) {
  return "https://www.jianshu.com/author/notebooks/".concat(noteID, "/notes");
};

var notebooksURL = "https://www.jianshu.com/author/notebooks";
var headers = {
  "Accept": "application/json",
  "Cookie": cookie
};

var articleTop = function articleTop(article) {
  var padToTwo = function padToTwo(number) {
    return number.toString().padStart(2, "0");
  };

  var date = new Date(article.content_updated_at * 1000);
  return "---\ntitle: ".concat(article.title, "\ndate: ").concat(date.getFullYear(), "-").concat(padToTwo(date.getMonth() + 1), "-").concat(padToTwo(date.getDate()), " ").concat(padToTwo(date.getHours()), ":").concat(padToTwo(date.getMinutes()), ":").concat(padToTwo(date.getSeconds()), "\ntags:\n---\n");
};

var migrateContentImage = function migrateContentImage(content) {
  var imageReg = /\(https\:\/\/upload\-images\.jianshu\.io\/upload_images\/(.+)\?.+\)/g;
  var result = Array.from(content.matchAll(imageReg));
  result.forEach(function (r) {
    downloadImage(r[0], r[1]);
  });
  return content.replace(imageReg, function (_, p) {
    return "(/images/" + p + ")";
  });
};

var downloadImage = function downloadImage(src, fileName) {
  var path, writer, res;
  return regeneratorRuntime.async(function downloadImage$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          path = "source/images/" + fileName;
          writer = fs.createWriteStream(path);
          _context.next = 4;
          return regeneratorRuntime.awrap(axios.get(src.slice(1, -1), {
            responseType: "stream"
          }));

        case 4:
          res = _context.sent;
          res.data.pipe(writer);

        case 6:
        case "end":
          return _context.stop();
      }
    }
  });
};

(function _callee() {
  var notebooks, notes, articles;
  return regeneratorRuntime.async(function _callee$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(axios.get(notebooksURL, {
            headers: headers
          }));

        case 2:
          notebooks = _context2.sent.data;
          _context2.next = 5;
          return regeneratorRuntime.awrap(Promise.all(notebooks.map(function (n) {
            return axios.get(articleListURL(n.id), {
              headers: headers
            });
          })));

        case 5:
          _context2.t0 = function (n) {
            return n.data;
          };

          _context2.t1 = function (prev, next) {
            return [].concat(_toConsumableArray(prev), _toConsumableArray(next));
          };

          _context2.t2 = [];
          notes = _context2.sent.map(_context2.t0).reduce(_context2.t1, _context2.t2);
          _context2.next = 11;
          return regeneratorRuntime.awrap(Promise.all(notes.map(function (n) {
            return axios.get(contentURL(n.id), {
              headers: headers
            });
          })));

        case 11:
          _context2.t3 = function (n, index) {
            return _objectSpread({}, notes[index], {
              content: n.data.content
            });
          };

          _context2.t4 = function (a) {
            return a.shared;
          };

          articles = _context2.sent.map(_context2.t3).filter(_context2.t4);
          articles.forEach(function (article) {
            var fileName = article.title.replace(/[\:\\\/\:\*\?\"\<\>\|]/, "_");
            fs.writeFileSync("source/_posts/" + fileName + ".md", articleTop(article) + migrateContentImage(article.content));
          });

        case 15:
        case "end":
          return _context2.stop();
      }
    }
  });
})();