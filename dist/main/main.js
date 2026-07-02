"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/fast-xml-parser/src/util.js
var require_util = __commonJS({
  "node_modules/fast-xml-parser/src/util.js"(exports2) {
    "use strict";
    var nameStartChar = ":A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD";
    var nameChar = nameStartChar + "\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040";
    var nameRegexp = "[" + nameStartChar + "][" + nameChar + "]*";
    var regexName = new RegExp("^" + nameRegexp + "$");
    var getAllMatches = function(string, regex) {
      const matches = [];
      let match = regex.exec(string);
      while (match) {
        const allmatches = [];
        allmatches.startIndex = regex.lastIndex - match[0].length;
        const len = match.length;
        for (let index = 0; index < len; index++) {
          allmatches.push(match[index]);
        }
        matches.push(allmatches);
        match = regex.exec(string);
      }
      return matches;
    };
    var isName = function(string) {
      const match = regexName.exec(string);
      return !(match === null || typeof match === "undefined");
    };
    exports2.isExist = function(v) {
      return typeof v !== "undefined";
    };
    exports2.isEmptyObject = function(obj) {
      return Object.keys(obj).length === 0;
    };
    exports2.merge = function(target, a, arrayMode) {
      if (a) {
        const keys = Object.keys(a);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          if (arrayMode === "strict") {
            target[keys[i]] = [a[keys[i]]];
          } else {
            target[keys[i]] = a[keys[i]];
          }
        }
      }
    };
    exports2.getValue = function(v) {
      if (exports2.isExist(v)) {
        return v;
      } else {
        return "";
      }
    };
    var DANGEROUS_PROPERTY_NAMES = [
      // '__proto__',
      // 'constructor',
      // 'prototype',
      "hasOwnProperty",
      "toString",
      "valueOf",
      "__defineGetter__",
      "__defineSetter__",
      "__lookupGetter__",
      "__lookupSetter__"
    ];
    var criticalProperties = ["__proto__", "constructor", "prototype"];
    exports2.isName = isName;
    exports2.getAllMatches = getAllMatches;
    exports2.nameRegexp = nameRegexp;
    exports2.DANGEROUS_PROPERTY_NAMES = DANGEROUS_PROPERTY_NAMES;
    exports2.criticalProperties = criticalProperties;
  }
});

// node_modules/fast-xml-parser/src/validator.js
var require_validator = __commonJS({
  "node_modules/fast-xml-parser/src/validator.js"(exports2) {
    "use strict";
    var util = require_util();
    var defaultOptions = {
      allowBooleanAttributes: false,
      //A tag can have attributes without any value
      unpairedTags: []
    };
    exports2.validate = function(xmlData, options) {
      options = Object.assign({}, defaultOptions, options);
      const tags = [];
      let tagFound = false;
      let reachedRoot = false;
      if (xmlData[0] === "\uFEFF") {
        xmlData = xmlData.substr(1);
      }
      for (let i = 0; i < xmlData.length; i++) {
        if (xmlData[i] === "<" && xmlData[i + 1] === "?") {
          i += 2;
          i = readPI(xmlData, i);
          if (i.err) return i;
        } else if (xmlData[i] === "<") {
          let tagStartPos = i;
          i++;
          if (xmlData[i] === "!") {
            i = readCommentAndCDATA(xmlData, i);
            continue;
          } else {
            let closingTag = false;
            if (xmlData[i] === "/") {
              closingTag = true;
              i++;
            }
            let tagName = "";
            for (; i < xmlData.length && xmlData[i] !== ">" && xmlData[i] !== " " && xmlData[i] !== "	" && xmlData[i] !== "\n" && xmlData[i] !== "\r"; i++) {
              tagName += xmlData[i];
            }
            tagName = tagName.trim();
            if (tagName[tagName.length - 1] === "/") {
              tagName = tagName.substring(0, tagName.length - 1);
              i--;
            }
            if (!validateTagName(tagName)) {
              let msg;
              if (tagName.trim().length === 0) {
                msg = "Invalid space after '<'.";
              } else {
                msg = "Tag '" + tagName + "' is an invalid name.";
              }
              return getErrorObject("InvalidTag", msg, getLineNumberForPosition(xmlData, i));
            }
            const result = readAttributeStr(xmlData, i);
            if (result === false) {
              return getErrorObject("InvalidAttr", "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
            }
            let attrStr = result.value;
            i = result.index;
            if (attrStr[attrStr.length - 1] === "/") {
              const attrStrStart = i - attrStr.length;
              attrStr = attrStr.substring(0, attrStr.length - 1);
              const isValid = validateAttributeString(attrStr, options);
              if (isValid === true) {
                tagFound = true;
              } else {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
              }
            } else if (closingTag) {
              if (!result.tagClosed) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
              } else if (attrStr.trim().length > 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
              } else if (tags.length === 0) {
                return getErrorObject("InvalidTag", "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
              } else {
                const otg = tags.pop();
                if (tagName !== otg.tagName) {
                  let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
                  return getErrorObject(
                    "InvalidTag",
                    "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                    getLineNumberForPosition(xmlData, tagStartPos)
                  );
                }
                if (tags.length == 0) {
                  reachedRoot = true;
                }
              }
            } else {
              const isValid = validateAttributeString(attrStr, options);
              if (isValid !== true) {
                return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
              }
              if (reachedRoot === true) {
                return getErrorObject("InvalidXml", "Multiple possible root nodes found.", getLineNumberForPosition(xmlData, i));
              } else if (options.unpairedTags.indexOf(tagName) !== -1) {
              } else {
                tags.push({ tagName, tagStartPos });
              }
              tagFound = true;
            }
            for (i++; i < xmlData.length; i++) {
              if (xmlData[i] === "<") {
                if (xmlData[i + 1] === "!") {
                  i++;
                  i = readCommentAndCDATA(xmlData, i);
                  continue;
                } else if (xmlData[i + 1] === "?") {
                  i = readPI(xmlData, ++i);
                  if (i.err) return i;
                } else {
                  break;
                }
              } else if (xmlData[i] === "&") {
                const afterAmp = validateAmpersand(xmlData, i);
                if (afterAmp == -1)
                  return getErrorObject("InvalidChar", "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
                i = afterAmp;
              } else {
                if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
                  return getErrorObject("InvalidXml", "Extra text at the end", getLineNumberForPosition(xmlData, i));
                }
              }
            }
            if (xmlData[i] === "<") {
              i--;
            }
          }
        } else {
          if (isWhiteSpace(xmlData[i])) {
            continue;
          }
          return getErrorObject("InvalidChar", "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
        }
      }
      if (!tagFound) {
        return getErrorObject("InvalidXml", "Start tag expected.", 1);
      } else if (tags.length == 1) {
        return getErrorObject("InvalidTag", "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
      } else if (tags.length > 0) {
        return getErrorObject("InvalidXml", "Invalid '" + JSON.stringify(tags.map((t) => t.tagName), null, 4).replace(/\r?\n/g, "") + "' found.", { line: 1, col: 1 });
      }
      return true;
    };
    function isWhiteSpace(char) {
      return char === " " || char === "	" || char === "\n" || char === "\r";
    }
    function readPI(xmlData, i) {
      const start = i;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] == "?" || xmlData[i] == " ") {
          const tagname = xmlData.substr(start, i - start);
          if (i > 5 && tagname === "xml") {
            return getErrorObject("InvalidXml", "XML declaration allowed only at the start of the document.", getLineNumberForPosition(xmlData, i));
          } else if (xmlData[i] == "?" && xmlData[i + 1] == ">") {
            i++;
            break;
          } else {
            continue;
          }
        }
      }
      return i;
    }
    function readCommentAndCDATA(xmlData, i) {
      if (xmlData.length > i + 5 && xmlData[i + 1] === "-" && xmlData[i + 2] === "-") {
        for (i += 3; i < xmlData.length; i++) {
          if (xmlData[i] === "-" && xmlData[i + 1] === "-" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      } else if (xmlData.length > i + 8 && xmlData[i + 1] === "D" && xmlData[i + 2] === "O" && xmlData[i + 3] === "C" && xmlData[i + 4] === "T" && xmlData[i + 5] === "Y" && xmlData[i + 6] === "P" && xmlData[i + 7] === "E") {
        let angleBracketsCount = 1;
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "<") {
            angleBracketsCount++;
          } else if (xmlData[i] === ">") {
            angleBracketsCount--;
            if (angleBracketsCount === 0) {
              break;
            }
          }
        }
      } else if (xmlData.length > i + 9 && xmlData[i + 1] === "[" && xmlData[i + 2] === "C" && xmlData[i + 3] === "D" && xmlData[i + 4] === "A" && xmlData[i + 5] === "T" && xmlData[i + 6] === "A" && xmlData[i + 7] === "[") {
        for (i += 8; i < xmlData.length; i++) {
          if (xmlData[i] === "]" && xmlData[i + 1] === "]" && xmlData[i + 2] === ">") {
            i += 2;
            break;
          }
        }
      }
      return i;
    }
    var doubleQuote = '"';
    var singleQuote = "'";
    function readAttributeStr(xmlData, i) {
      let attrStr = "";
      let startChar = "";
      let tagClosed = false;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
          if (startChar === "") {
            startChar = xmlData[i];
          } else if (startChar !== xmlData[i]) {
          } else {
            startChar = "";
          }
        } else if (xmlData[i] === ">") {
          if (startChar === "") {
            tagClosed = true;
            break;
          }
        }
        attrStr += xmlData[i];
      }
      if (startChar !== "") {
        return false;
      }
      return {
        value: attrStr,
        index: i,
        tagClosed
      };
    }
    var validAttrStrRegxp = new RegExp(`(\\s*)([^\\s=]+)(\\s*=)?(\\s*(['"])(([\\s\\S])*?)\\5)?`, "g");
    function validateAttributeString(attrStr, options) {
      const matches = util.getAllMatches(attrStr, validAttrStrRegxp);
      const attrNames = {};
      for (let i = 0; i < matches.length; i++) {
        if (matches[i][1].length === 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] !== void 0 && matches[i][4] === void 0) {
          return getErrorObject("InvalidAttr", "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
        } else if (matches[i][3] === void 0 && !options.allowBooleanAttributes) {
          return getErrorObject("InvalidAttr", "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
        }
        const attrName = matches[i][2];
        if (!validateAttrName(attrName)) {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
        }
        if (!attrNames.hasOwnProperty(attrName)) {
          attrNames[attrName] = 1;
        } else {
          return getErrorObject("InvalidAttr", "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
        }
      }
      return true;
    }
    function validateNumberAmpersand(xmlData, i) {
      let re = /\d/;
      if (xmlData[i] === "x") {
        i++;
        re = /[\da-fA-F]/;
      }
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === ";")
          return i;
        if (!xmlData[i].match(re))
          break;
      }
      return -1;
    }
    function validateAmpersand(xmlData, i) {
      i++;
      if (xmlData[i] === ";")
        return -1;
      if (xmlData[i] === "#") {
        i++;
        return validateNumberAmpersand(xmlData, i);
      }
      let count = 0;
      for (; i < xmlData.length; i++, count++) {
        if (xmlData[i].match(/\w/) && count < 20)
          continue;
        if (xmlData[i] === ";")
          break;
        return -1;
      }
      return i;
    }
    function getErrorObject(code, message, lineNumber) {
      return {
        err: {
          code,
          msg: message,
          line: lineNumber.line || lineNumber,
          col: lineNumber.col
        }
      };
    }
    function validateAttrName(attrName) {
      return util.isName(attrName);
    }
    function validateTagName(tagname) {
      return util.isName(tagname);
    }
    function getLineNumberForPosition(xmlData, index) {
      const lines = xmlData.substring(0, index).split(/\r?\n/);
      return {
        line: lines.length,
        // column number is last line's length + 1, because column numbering starts at 1:
        col: lines[lines.length - 1].length + 1
      };
    }
    function getPositionFromMatch(match) {
      return match.startIndex + match[1].length;
    }
  }
});

// node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js
var require_OptionsBuilder = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js"(exports2) {
    var { DANGEROUS_PROPERTY_NAMES, criticalProperties } = require_util();
    var defaultOnDangerousProperty = (name) => {
      if (DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return "__" + name;
      }
      return name;
    };
    var defaultOptions = {
      preserveOrder: false,
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      removeNSPrefix: false,
      // remove NS from tag name or attribute name if true
      allowBooleanAttributes: false,
      //a tag can have attributes without any value
      //ignoreRootElement : false,
      parseTagValue: true,
      parseAttributeValue: false,
      trimValues: true,
      //Trim string values of tag and attributes
      cdataPropName: false,
      numberParseOptions: {
        hex: true,
        leadingZeros: true,
        eNotation: true
      },
      tagValueProcessor: function(tagName, val) {
        return val;
      },
      attributeValueProcessor: function(attrName, val) {
        return val;
      },
      stopNodes: [],
      //nested tags will not be parsed even for errors
      alwaysCreateTextNode: false,
      isArray: () => false,
      commentPropName: false,
      unpairedTags: [],
      processEntities: true,
      htmlEntities: false,
      ignoreDeclaration: false,
      ignorePiTags: false,
      transformTagName: false,
      transformAttributeName: false,
      updateTag: function(tagName, jPath, attrs) {
        return tagName;
      },
      // skipEmptyListItem: false
      captureMetaData: false,
      maxNestedTags: 100,
      strictReservedNames: true,
      onDangerousProperty: defaultOnDangerousProperty
    };
    function validatePropertyName(propertyName, optionName) {
      if (typeof propertyName !== "string") {
        return;
      }
      const normalized = propertyName.toLowerCase();
      if (DANGEROUS_PROPERTY_NAMES.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
      if (criticalProperties.some((dangerous) => normalized === dangerous.toLowerCase())) {
        throw new Error(
          `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
        );
      }
    }
    function normalizeProcessEntities(value) {
      if (typeof value === "boolean") {
        return {
          enabled: value,
          // true or false
          maxEntitySize: 1e4,
          maxExpansionDepth: 10,
          maxTotalExpansions: 1e3,
          maxExpandedLength: 1e5,
          allowedTags: null,
          tagFilter: null
        };
      }
      if (typeof value === "object" && value !== null) {
        return {
          enabled: value.enabled !== false,
          maxEntitySize: Math.max(1, value.maxEntitySize ?? 1e4),
          maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 1e4),
          maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
          maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 1e5),
          maxEntityCount: Math.max(1, value.maxEntityCount ?? 1e3),
          allowedTags: value.allowedTags ?? null,
          tagFilter: value.tagFilter ?? null
        };
      }
      return normalizeProcessEntities(true);
    }
    var buildOptions = function(options) {
      const built = Object.assign({}, defaultOptions, options);
      const propertyNameOptions = [
        { value: built.attributeNamePrefix, name: "attributeNamePrefix" },
        { value: built.attributesGroupName, name: "attributesGroupName" },
        { value: built.textNodeName, name: "textNodeName" },
        { value: built.cdataPropName, name: "cdataPropName" },
        { value: built.commentPropName, name: "commentPropName" }
      ];
      for (const { value, name } of propertyNameOptions) {
        if (value) {
          validatePropertyName(value, name);
        }
      }
      if (built.onDangerousProperty === null) {
        built.onDangerousProperty = defaultOnDangerousProperty;
      }
      built.processEntities = normalizeProcessEntities(built.processEntities);
      return built;
    };
    exports2.buildOptions = buildOptions;
    exports2.defaultOptions = defaultOptions;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/xmlNode.js
var require_xmlNode = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/xmlNode.js"(exports2, module2) {
    "use strict";
    var XmlNode = class {
      constructor(tagname) {
        this.tagname = tagname;
        this.child = [];
        this[":@"] = {};
      }
      add(key, val) {
        if (key === "__proto__") key = "#__proto__";
        this.child.push({ [key]: val });
      }
      addChild(node) {
        if (node.tagname === "__proto__") node.tagname = "#__proto__";
        if (node[":@"] && Object.keys(node[":@"]).length > 0) {
          this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
        } else {
          this.child.push({ [node.tagname]: node.child });
        }
      }
    };
    module2.exports = XmlNode;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js
var require_DocTypeReader = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js"(exports2, module2) {
    var util = require_util();
    var DocTypeReader = class {
      constructor(options) {
        this.suppressValidationErr = !options;
        this.options = options || {};
      }
      readDocType(xmlData, i) {
        const entities = /* @__PURE__ */ Object.create(null);
        let entityCount = 0;
        if (xmlData[i + 3] === "O" && xmlData[i + 4] === "C" && xmlData[i + 5] === "T" && xmlData[i + 6] === "Y" && xmlData[i + 7] === "P" && xmlData[i + 8] === "E") {
          i = i + 9;
          let angleBracketsCount = 1;
          let hasBody = false, comment = false;
          let exp = "";
          for (; i < xmlData.length; i++) {
            if (xmlData[i] === "<" && !comment) {
              if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
                i += 7;
                let entityName, val;
                [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
                if (val.indexOf("&") === -1) {
                  if (this.options.enabled !== false && this.options.maxEntityCount != null && entityCount >= this.options.maxEntityCount) {
                    throw new Error(
                      `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                    );
                  }
                  const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                  entities[entityName] = {
                    regx: RegExp(`&${escaped};`, "g"),
                    val
                  };
                  entityCount++;
                }
              } else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
                i += 8;
                const { index } = this.readElementExp(xmlData, i + 1);
                i = index;
              } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
                i += 8;
              } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
                i += 9;
                const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
                i = index;
              } else if (hasSeq(xmlData, "!--", i)) {
                comment = true;
              } else {
                throw new Error(`Invalid DOCTYPE`);
              }
              angleBracketsCount++;
              exp = "";
            } else if (xmlData[i] === ">") {
              if (comment) {
                if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
                  comment = false;
                  angleBracketsCount--;
                }
              } else {
                angleBracketsCount--;
              }
              if (angleBracketsCount === 0) {
                break;
              }
            } else if (xmlData[i] === "[") {
              hasBody = true;
            } else {
              exp += xmlData[i];
            }
          }
          if (angleBracketsCount !== 0) {
            throw new Error(`Unclosed DOCTYPE`);
          }
        } else {
          throw new Error(`Invalid Tag instead of DOCTYPE`);
        }
        return { entities, i };
      }
      readEntityExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let entityName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
          entityName += xmlData[i];
          i++;
        }
        validateEntityName(entityName);
        i = skipWhitespace(xmlData, i);
        if (!this.suppressValidationErr) {
          if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
            throw new Error("External entities are not supported");
          } else if (xmlData[i] === "%") {
            throw new Error("Parameter entities are not supported");
          }
        }
        let entityValue = "";
        [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");
        if (this.options.enabled !== false && this.options.maxEntitySize != null && entityValue.length > this.options.maxEntitySize) {
          throw new Error(
            `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
          );
        }
        i--;
        return [entityName, entityValue, i];
      }
      readNotationExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let notationName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          notationName += xmlData[i];
          i++;
        }
        !this.suppressValidationErr && validateEntityName(notationName);
        i = skipWhitespace(xmlData, i);
        const identifierType = xmlData.substring(i, i + 6).toUpperCase();
        if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
          throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
        }
        i += identifierType.length;
        i = skipWhitespace(xmlData, i);
        let publicIdentifier = null;
        let systemIdentifier = null;
        if (identifierType === "PUBLIC") {
          [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] === '"' || xmlData[i] === "'") {
            [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          }
        } else if (identifierType === "SYSTEM") {
          [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
          if (!this.suppressValidationErr && !systemIdentifier) {
            throw new Error("Missing mandatory system identifier for SYSTEM notation");
          }
        }
        return { notationName, publicIdentifier, systemIdentifier, index: --i };
      }
      readIdentifierVal(xmlData, i, type) {
        let identifierVal = "";
        const startChar = xmlData[i];
        if (startChar !== '"' && startChar !== "'") {
          throw new Error(`Expected quoted string, found "${startChar}"`);
        }
        i++;
        while (i < xmlData.length && xmlData[i] !== startChar) {
          identifierVal += xmlData[i];
          i++;
        }
        if (xmlData[i] !== startChar) {
          throw new Error(`Unterminated ${type} value`);
        }
        i++;
        return [i, identifierVal];
      }
      readElementExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        if (!this.suppressValidationErr && !util.isName(elementName)) {
          throw new Error(`Invalid element name: "${elementName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let contentModel = "";
        if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) {
          i += 4;
        } else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) {
          i += 2;
        } else if (xmlData[i] === "(") {
          i++;
          while (i < xmlData.length && xmlData[i] !== ")") {
            contentModel += xmlData[i];
            i++;
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated content model");
          }
        } else if (!this.suppressValidationErr) {
          throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
        }
        return {
          elementName,
          contentModel: contentModel.trim(),
          index: i
        };
      }
      readAttlistExp(xmlData, i) {
        i = skipWhitespace(xmlData, i);
        let elementName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          elementName += xmlData[i];
          i++;
        }
        validateEntityName(elementName);
        i = skipWhitespace(xmlData, i);
        let attributeName = "";
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
          attributeName += xmlData[i];
          i++;
        }
        if (!validateEntityName(attributeName)) {
          throw new Error(`Invalid attribute name: "${attributeName}"`);
        }
        i = skipWhitespace(xmlData, i);
        let attributeType = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
          attributeType = "NOTATION";
          i += 8;
          i = skipWhitespace(xmlData, i);
          if (xmlData[i] !== "(") {
            throw new Error(`Expected '(', found "${xmlData[i]}"`);
          }
          i++;
          let allowedNotations = [];
          while (i < xmlData.length && xmlData[i] !== ")") {
            let notation = "";
            while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
              notation += xmlData[i];
              i++;
            }
            notation = notation.trim();
            if (!validateEntityName(notation)) {
              throw new Error(`Invalid notation name: "${notation}"`);
            }
            allowedNotations.push(notation);
            if (xmlData[i] === "|") {
              i++;
              i = skipWhitespace(xmlData, i);
            }
          }
          if (xmlData[i] !== ")") {
            throw new Error("Unterminated list of notations");
          }
          i++;
          attributeType += " (" + allowedNotations.join("|") + ")";
        } else {
          while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            attributeType += xmlData[i];
            i++;
          }
          const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
          if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
            throw new Error(`Invalid attribute type: "${attributeType}"`);
          }
        }
        i = skipWhitespace(xmlData, i);
        let defaultValue = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
          defaultValue = "#REQUIRED";
          i += 8;
        } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
          defaultValue = "#IMPLIED";
          i += 7;
        } else {
          [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
        }
        return {
          elementName,
          attributeName,
          attributeType,
          defaultValue,
          index: i
        };
      }
    };
    var skipWhitespace = (data, index) => {
      while (index < data.length && /\s/.test(data[index])) {
        index++;
      }
      return index;
    };
    function hasSeq(data, seq, i) {
      for (let j = 0; j < seq.length; j++) {
        if (seq[j] !== data[i + j + 1]) return false;
      }
      return true;
    }
    function validateEntityName(name) {
      if (util.isName(name))
        return name;
      else
        throw new Error(`Invalid entity name ${name}`);
    }
    module2.exports = DocTypeReader;
  }
});

// node_modules/strnum/strnum.js
var require_strnum = __commonJS({
  "node_modules/strnum/strnum.js"(exports2, module2) {
    var hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
    var numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;
    var consider = {
      hex: true,
      // oct: false,
      leadingZeros: true,
      decimalPoint: ".",
      eNotation: true
      //skipLike: /regex/
    };
    function toNumber(str, options = {}) {
      options = Object.assign({}, consider, options);
      if (!str || typeof str !== "string") return str;
      let trimmedStr = str.trim();
      if (options.skipLike !== void 0 && options.skipLike.test(trimmedStr)) return str;
      else if (str === "0") return 0;
      else if (options.hex && hexRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 16);
      } else if (trimmedStr.search(/[eE]/) !== -1) {
        const notation = trimmedStr.match(/^([-\+])?(0*)([0-9]*(\.[0-9]*)?[eE][-\+]?[0-9]+)$/);
        if (notation) {
          if (options.leadingZeros) {
            trimmedStr = (notation[1] || "") + notation[3];
          } else {
            if (notation[2] === "0" && notation[3][0] === ".") {
            } else {
              return str;
            }
          }
          return options.eNotation ? Number(trimmedStr) : str;
        } else {
          return str;
        }
      } else {
        const match = numRegex.exec(trimmedStr);
        if (match) {
          const sign = match[1];
          const leadingZeros = match[2];
          let numTrimmedByZeros = trimZeros(match[3]);
          if (!options.leadingZeros && leadingZeros.length > 0 && sign && trimmedStr[2] !== ".") return str;
          else if (!options.leadingZeros && leadingZeros.length > 0 && !sign && trimmedStr[1] !== ".") return str;
          else if (options.leadingZeros && leadingZeros === str) return 0;
          else {
            const num = Number(trimmedStr);
            const numStr = "" + num;
            if (numStr.search(/[eE]/) !== -1) {
              if (options.eNotation) return num;
              else return str;
            } else if (trimmedStr.indexOf(".") !== -1) {
              if (numStr === "0" && numTrimmedByZeros === "") return num;
              else if (numStr === numTrimmedByZeros) return num;
              else if (sign && numStr === "-" + numTrimmedByZeros) return num;
              else return str;
            }
            if (leadingZeros) {
              return numTrimmedByZeros === numStr || sign + numTrimmedByZeros === numStr ? num : str;
            } else {
              return trimmedStr === numStr || trimmedStr === sign + numStr ? num : str;
            }
          }
        } else {
          return str;
        }
      }
    }
    function trimZeros(numStr) {
      if (numStr && numStr.indexOf(".") !== -1) {
        numStr = numStr.replace(/0+$/, "");
        if (numStr === ".") numStr = "0";
        else if (numStr[0] === ".") numStr = "0" + numStr;
        else if (numStr[numStr.length - 1] === ".") numStr = numStr.substr(0, numStr.length - 1);
        return numStr;
      }
      return numStr;
    }
    function parse_int(numStr, base) {
      if (parseInt) return parseInt(numStr, base);
      else if (Number.parseInt) return Number.parseInt(numStr, base);
      else if (window && window.parseInt) return window.parseInt(numStr, base);
      else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
    }
    module2.exports = toNumber;
  }
});

// node_modules/fast-xml-parser/src/ignoreAttributes.js
var require_ignoreAttributes = __commonJS({
  "node_modules/fast-xml-parser/src/ignoreAttributes.js"(exports2, module2) {
    function getIgnoreAttributesFn(ignoreAttributes) {
      if (typeof ignoreAttributes === "function") {
        return ignoreAttributes;
      }
      if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
          for (const pattern of ignoreAttributes) {
            if (typeof pattern === "string" && attrName === pattern) {
              return true;
            }
            if (pattern instanceof RegExp && pattern.test(attrName)) {
              return true;
            }
          }
        };
      }
      return () => false;
    }
    module2.exports = getIgnoreAttributesFn;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js
var require_OrderedObjParser = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js"(exports2, module2) {
    "use strict";
    var util = require_util();
    var xmlNode = require_xmlNode();
    var DocTypeReader = require_DocTypeReader();
    var toNumber = require_strnum();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var OrderedObjParser = class {
      constructor(options) {
        this.options = options;
        this.currentNode = null;
        this.tagsNodeStack = [];
        this.docTypeEntities = {};
        this.lastEntities = {
          "apos": { regex: /&(apos|#39|#x27);/g, val: "'" },
          "gt": { regex: /&(gt|#62|#x3E);/g, val: ">" },
          "lt": { regex: /&(lt|#60|#x3C);/g, val: "<" },
          "quot": { regex: /&(quot|#34|#x22);/g, val: '"' }
        };
        this.ampEntity = { regex: /&(amp|#38|#x26);/g, val: "&" };
        this.htmlEntities = {
          "space": { regex: /&(nbsp|#160);/g, val: " " },
          // "lt" : { regex: /&(lt|#60);/g, val: "<" },
          // "gt" : { regex: /&(gt|#62);/g, val: ">" },
          // "amp" : { regex: /&(amp|#38);/g, val: "&" },
          // "quot" : { regex: /&(quot|#34);/g, val: "\"" },
          // "apos" : { regex: /&(apos|#39);/g, val: "'" },
          "cent": { regex: /&(cent|#162);/g, val: "\xA2" },
          "pound": { regex: /&(pound|#163);/g, val: "\xA3" },
          "yen": { regex: /&(yen|#165);/g, val: "\xA5" },
          "euro": { regex: /&(euro|#8364);/g, val: "\u20AC" },
          "copyright": { regex: /&(copy|#169);/g, val: "\xA9" },
          "reg": { regex: /&(reg|#174);/g, val: "\xAE" },
          "inr": { regex: /&(inr|#8377);/g, val: "\u20B9" },
          "num_dec": { regex: /&#([0-9]{1,7});/g, val: (_, str) => fromCodePoint(str, 10, "&#") },
          "num_hex": { regex: /&#x([0-9a-fA-F]{1,6});/g, val: (_, str) => fromCodePoint(str, 16, "&#x") }
        };
        this.addExternalEntities = addExternalEntities;
        this.parseXml = parseXml;
        this.parseTextData = parseTextData;
        this.resolveNameSpace = resolveNameSpace;
        this.buildAttributesMap = buildAttributesMap;
        this.isItStopNode = isItStopNode;
        this.replaceEntitiesValue = replaceEntitiesValue;
        this.readStopNodeData = readStopNodeData;
        this.saveTextToParentTag = saveTextToParentTag;
        this.addChild = addChild;
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.entityExpansionCount = 0;
        this.currentExpandedLength = 0;
        if (this.options.stopNodes && this.options.stopNodes.length > 0) {
          this.stopNodesExact = /* @__PURE__ */ new Set();
          this.stopNodesWildcard = /* @__PURE__ */ new Set();
          for (let i = 0; i < this.options.stopNodes.length; i++) {
            const stopNodeExp = this.options.stopNodes[i];
            if (typeof stopNodeExp !== "string") continue;
            if (stopNodeExp.startsWith("*.")) {
              this.stopNodesWildcard.add(stopNodeExp.substring(2));
            } else {
              this.stopNodesExact.add(stopNodeExp);
            }
          }
        }
      }
    };
    function addExternalEntities(externalEntities) {
      const entKeys = Object.keys(externalEntities);
      for (let i = 0; i < entKeys.length; i++) {
        const ent = entKeys[i];
        const escaped = ent.replace(/[.\-+*:]/g, "\\.");
        this.lastEntities[ent] = {
          regex: new RegExp("&" + escaped + ";", "g"),
          val: externalEntities[ent]
        };
      }
    }
    function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
      if (val !== void 0) {
        if (this.options.trimValues && !dontTrim) {
          val = val.trim();
        }
        if (val.length > 0) {
          if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);
          const newval = this.options.tagValueProcessor(tagName, val, jPath, hasAttributes, isLeafNode);
          if (newval === null || newval === void 0) {
            return val;
          } else if (typeof newval !== typeof val || newval !== val) {
            return newval;
          } else if (this.options.trimValues) {
            return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
          } else {
            const trimmedVal = val.trim();
            if (trimmedVal === val) {
              return parseValue(val, this.options.parseTagValue, this.options.numberParseOptions);
            } else {
              return val;
            }
          }
        }
      }
    }
    function resolveNameSpace(tagname) {
      if (this.options.removeNSPrefix) {
        const tags = tagname.split(":");
        const prefix = tagname.charAt(0) === "/" ? "/" : "";
        if (tags[0] === "xmlns") {
          return "";
        }
        if (tags.length === 2) {
          tagname = prefix + tags[1];
        }
      }
      return tagname;
    }
    var attrsRegx = new RegExp(`([^\\s=]+)\\s*(=\\s*(['"])([\\s\\S]*?)\\3)?`, "gm");
    function buildAttributesMap(attrStr, jPath, tagName) {
      if (this.options.ignoreAttributes !== true && typeof attrStr === "string") {
        const matches = util.getAllMatches(attrStr, attrsRegx);
        const len = matches.length;
        const attrs = {};
        for (let i = 0; i < len; i++) {
          const attrName = this.resolveNameSpace(matches[i][1]);
          if (this.ignoreAttributesFn(attrName, jPath)) {
            continue;
          }
          let oldVal = matches[i][4];
          let aName = this.options.attributeNamePrefix + attrName;
          if (attrName.length) {
            if (this.options.transformAttributeName) {
              aName = this.options.transformAttributeName(aName);
            }
            aName = sanitizeName(aName, this.options);
            if (oldVal !== void 0) {
              if (this.options.trimValues) {
                oldVal = oldVal.trim();
              }
              oldVal = this.replaceEntitiesValue(oldVal, tagName, jPath);
              const newVal = this.options.attributeValueProcessor(attrName, oldVal, jPath);
              if (newVal === null || newVal === void 0) {
                attrs[aName] = oldVal;
              } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
                attrs[aName] = newVal;
              } else {
                attrs[aName] = parseValue(
                  oldVal,
                  this.options.parseAttributeValue,
                  this.options.numberParseOptions
                );
              }
            } else if (this.options.allowBooleanAttributes) {
              attrs[aName] = true;
            }
          }
        }
        if (!Object.keys(attrs).length) {
          return;
        }
        if (this.options.attributesGroupName) {
          const attrCollection = {};
          attrCollection[this.options.attributesGroupName] = attrs;
          return attrCollection;
        }
        return attrs;
      }
    }
    var parseXml = function(xmlData) {
      xmlData = xmlData.replace(/\r\n?/g, "\n");
      const xmlObj = new xmlNode("!xml");
      let currentNode = xmlObj;
      let textData = "";
      let jPath = "";
      this.entityExpansionCount = 0;
      this.currentExpandedLength = 0;
      const docTypeReader = new DocTypeReader(this.options.processEntities);
      for (let i = 0; i < xmlData.length; i++) {
        const ch = xmlData[i];
        if (ch === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.");
            let tagName = xmlData.substring(i + 2, closeIndex).trim();
            if (this.options.removeNSPrefix) {
              const colonIndex = tagName.indexOf(":");
              if (colonIndex !== -1) {
                tagName = tagName.substr(colonIndex + 1);
              }
            }
            if (this.options.transformTagName) {
              tagName = this.options.transformTagName(tagName);
            }
            if (currentNode) {
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
            }
            const lastTagName = jPath.substring(jPath.lastIndexOf(".") + 1);
            if (tagName && this.options.unpairedTags.indexOf(tagName) !== -1) {
              throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
            }
            let propIndex = 0;
            if (lastTagName && this.options.unpairedTags.indexOf(lastTagName) !== -1) {
              propIndex = jPath.lastIndexOf(".", jPath.lastIndexOf(".") - 1);
              this.tagsNodeStack.pop();
            } else {
              propIndex = jPath.lastIndexOf(".");
            }
            jPath = jPath.substring(0, propIndex);
            currentNode = this.tagsNodeStack.pop();
            textData = "";
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            let tagData = readTagExp(xmlData, i, false, "?>");
            if (!tagData) throw new Error("Pi Tag is not closed.");
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            if (this.options.ignoreDeclaration && tagData.tagName === "?xml" || this.options.ignorePiTags) {
            } else {
              const childNode = new xmlNode(tagData.tagName);
              childNode.add(this.options.textNodeName, "");
              if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagData.tagExp, jPath, tagData.tagName);
              }
              this.addChild(currentNode, childNode, jPath, i);
            }
            i = tagData.closeIndex + 1;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.");
            if (this.options.commentPropName) {
              const comment = xmlData.substring(i + 4, endIndex - 2);
              textData = this.saveTextToParentTag(textData, currentNode, jPath);
              currentNode.add(this.options.commentPropName, [{ [this.options.textNodeName]: comment }]);
            }
            i = endIndex;
          } else if (xmlData.substr(i + 1, 2) === "!D") {
            const result = docTypeReader.readDocType(xmlData, i);
            this.docTypeEntities = result.entities;
            i = result.i;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
            const tagExp = xmlData.substring(i + 9, closeIndex);
            textData = this.saveTextToParentTag(textData, currentNode, jPath);
            let val = this.parseTextData(tagExp, currentNode.tagname, jPath, true, false, true, true);
            if (val == void 0) val = "";
            if (this.options.cdataPropName) {
              currentNode.add(this.options.cdataPropName, [{ [this.options.textNodeName]: tagExp }]);
            } else {
              currentNode.add(this.options.textNodeName, val);
            }
            i = closeIndex + 2;
          } else {
            let result = readTagExp(xmlData, i, this.options.removeNSPrefix);
            let tagName = result.tagName;
            const rawTagName = result.rawTagName;
            let tagExp = result.tagExp;
            let attrExpPresent = result.attrExpPresent;
            let closeIndex = result.closeIndex;
            if (this.options.transformTagName) {
              const newTagName = this.options.transformTagName(tagName);
              if (tagExp === tagName) {
                tagExp = newTagName;
              }
              tagName = newTagName;
            }
            if (this.options.strictReservedNames && (tagName === this.options.commentPropName || tagName === this.options.cdataPropName || tagName === this.options.textNodeName || tagName === this.options.attributesGroupName)) {
              throw new Error(`Invalid tag name: ${tagName}`);
            }
            if (currentNode && textData) {
              if (currentNode.tagname !== "!xml") {
                textData = this.saveTextToParentTag(textData, currentNode, jPath, false);
              }
            }
            const lastTag = currentNode;
            if (lastTag && this.options.unpairedTags.indexOf(lastTag.tagname) !== -1) {
              currentNode = this.tagsNodeStack.pop();
              jPath = jPath.substring(0, jPath.lastIndexOf("."));
            }
            if (tagName !== xmlObj.tagname) {
              jPath += jPath ? "." + tagName : tagName;
            }
            const startIndex = i;
            if (this.isItStopNode(this.stopNodesExact, this.stopNodesWildcard, jPath, tagName)) {
              let tagContent = "";
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                i = result.closeIndex;
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                i = result.closeIndex;
              } else {
                const result2 = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
                if (!result2) throw new Error(`Unexpected end of ${rawTagName}`);
                i = result2.i;
                tagContent = result2.tagContent;
              }
              const childNode = new xmlNode(tagName);
              if (tagName !== tagExp && attrExpPresent) {
                childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
              }
              if (tagContent) {
                tagContent = this.parseTextData(tagContent, tagName, jPath, true, attrExpPresent, true, true);
              }
              jPath = jPath.substr(0, jPath.lastIndexOf("."));
              childNode.add(this.options.textNodeName, tagContent);
              this.addChild(currentNode, childNode, jPath, startIndex);
            } else {
              if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
                if (tagName[tagName.length - 1] === "/") {
                  tagName = tagName.substr(0, tagName.length - 1);
                  jPath = jPath.substr(0, jPath.length - 1);
                  tagExp = tagName;
                } else {
                  tagExp = tagExp.substr(0, tagExp.length - 1);
                }
                if (this.options.transformTagName) {
                  const newTagName = this.options.transformTagName(tagName);
                  if (tagExp === tagName) {
                    tagExp = newTagName;
                  }
                  tagName = newTagName;
                }
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
              } else if (this.options.unpairedTags.indexOf(tagName) !== -1) {
                const childNode = new xmlNode(tagName);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath);
                }
                this.addChild(currentNode, childNode, jPath, startIndex);
                jPath = jPath.substr(0, jPath.lastIndexOf("."));
                i = result.closeIndex;
                continue;
              } else {
                const childNode = new xmlNode(tagName);
                if (this.tagsNodeStack.length > this.options.maxNestedTags) {
                  throw new Error("Maximum nested tags exceeded");
                }
                this.tagsNodeStack.push(currentNode);
                if (tagName !== tagExp && attrExpPresent) {
                  childNode[":@"] = this.buildAttributesMap(tagExp, jPath, tagName);
                }
                this.addChild(currentNode, childNode, jPath);
                currentNode = childNode;
              }
              textData = "";
              i = closeIndex;
            }
          }
        } else {
          textData += xmlData[i];
        }
      }
      return xmlObj.child;
    };
    function addChild(currentNode, childNode, jPath, startIndex) {
      if (!this.options.captureMetaData) startIndex = void 0;
      const result = this.options.updateTag(childNode.tagname, jPath, childNode[":@"]);
      if (result === false) {
      } else if (typeof result === "string") {
        childNode.tagname = result;
        currentNode.addChild(childNode, startIndex);
      } else {
        currentNode.addChild(childNode, startIndex);
      }
    }
    var replaceEntitiesValue = function(val, tagName, jPath) {
      if (val.indexOf("&") === -1) {
        return val;
      }
      const entityConfig = this.options.processEntities;
      if (!entityConfig.enabled) {
        return val;
      }
      if (entityConfig.allowedTags) {
        if (!entityConfig.allowedTags.includes(tagName)) {
          return val;
        }
      }
      if (entityConfig.tagFilter) {
        if (!entityConfig.tagFilter(tagName, jPath)) {
          return val;
        }
      }
      for (let entityName in this.docTypeEntities) {
        const entity = this.docTypeEntities[entityName];
        const matches = val.match(entity.regx);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
          const lengthBefore = val.length;
          val = val.replace(entity.regx, entity.val);
          if (entityConfig.maxExpandedLength) {
            this.currentExpandedLength += val.length - lengthBefore;
            if (this.currentExpandedLength > entityConfig.maxExpandedLength) {
              throw new Error(
                `Total expanded content size exceeded: ${this.currentExpandedLength} > ${entityConfig.maxExpandedLength}`
              );
            }
          }
        }
      }
      if (val.indexOf("&") === -1) return val;
      for (const entityName of Object.keys(this.lastEntities)) {
        const entity = this.lastEntities[entityName];
        const matches = val.match(entity.regex);
        if (matches) {
          this.entityExpansionCount += matches.length;
          if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
            throw new Error(
              `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
            );
          }
        }
        val = val.replace(entity.regex, entity.val);
      }
      if (val.indexOf("&") === -1) return val;
      if (this.options.htmlEntities) {
        for (const entityName of Object.keys(this.htmlEntities)) {
          const entity = this.htmlEntities[entityName];
          const matches = val.match(entity.regex);
          if (matches) {
            this.entityExpansionCount += matches.length;
            if (entityConfig.maxTotalExpansions && this.entityExpansionCount > entityConfig.maxTotalExpansions) {
              throw new Error(
                `Entity expansion limit exceeded: ${this.entityExpansionCount} > ${entityConfig.maxTotalExpansions}`
              );
            }
          }
          val = val.replace(entity.regex, entity.val);
        }
      }
      val = val.replace(this.ampEntity.regex, this.ampEntity.val);
      return val;
    };
    function saveTextToParentTag(textData, parentNode, jPath, isLeafNode) {
      if (textData) {
        if (isLeafNode === void 0) isLeafNode = parentNode.child.length === 0;
        textData = this.parseTextData(
          textData,
          parentNode.tagname,
          jPath,
          false,
          parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
          isLeafNode
        );
        if (textData !== void 0 && textData !== "")
          parentNode.add(this.options.textNodeName, textData);
        textData = "";
      }
      return textData;
    }
    function isItStopNode(stopNodesExact, stopNodesWildcard, jPath, currentTagName) {
      if (stopNodesWildcard && stopNodesWildcard.has(currentTagName)) return true;
      if (stopNodesExact && stopNodesExact.has(jPath)) return true;
      return false;
    }
    function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
      let attrBoundary;
      let tagExp = "";
      for (let index = i; index < xmlData.length; index++) {
        let ch = xmlData[index];
        if (attrBoundary) {
          if (ch === attrBoundary) attrBoundary = "";
        } else if (ch === '"' || ch === "'") {
          attrBoundary = ch;
        } else if (ch === closingChar[0]) {
          if (closingChar[1]) {
            if (xmlData[index + 1] === closingChar[1]) {
              return {
                data: tagExp,
                index
              };
            }
          } else {
            return {
              data: tagExp,
              index
            };
          }
        } else if (ch === "	") {
          ch = " ";
        }
        tagExp += ch;
      }
    }
    function findClosingIndex(xmlData, str, i, errMsg) {
      const closingIndex = xmlData.indexOf(str, i);
      if (closingIndex === -1) {
        throw new Error(errMsg);
      } else {
        return closingIndex + str.length - 1;
      }
    }
    function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
      const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
      if (!result) return;
      let tagExp = result.data;
      const closeIndex = result.index;
      const separatorIndex = tagExp.search(/\s/);
      let tagName = tagExp;
      let attrExpPresent = true;
      if (separatorIndex !== -1) {
        tagName = tagExp.substring(0, separatorIndex);
        tagExp = tagExp.substring(separatorIndex + 1).trimStart();
      }
      const rawTagName = tagName;
      if (removeNSPrefix) {
        const colonIndex = tagName.indexOf(":");
        if (colonIndex !== -1) {
          tagName = tagName.substr(colonIndex + 1);
          attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
        }
      }
      return {
        tagName,
        tagExp,
        closeIndex,
        attrExpPresent,
        rawTagName
      };
    }
    function readStopNodeData(xmlData, tagName, i) {
      const startIndex = i;
      let openTagCount = 1;
      for (; i < xmlData.length; i++) {
        if (xmlData[i] === "<") {
          if (xmlData[i + 1] === "/") {
            const closeIndex = findClosingIndex(xmlData, ">", i, `${tagName} is not closed`);
            let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
            if (closeTagName === tagName) {
              openTagCount--;
              if (openTagCount === 0) {
                return {
                  tagContent: xmlData.substring(startIndex, i),
                  i: closeIndex
                };
              }
            }
            i = closeIndex;
          } else if (xmlData[i + 1] === "?") {
            const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 3) === "!--") {
            const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.");
            i = closeIndex;
          } else if (xmlData.substr(i + 1, 2) === "![") {
            const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
            i = closeIndex;
          } else {
            const tagData = readTagExp(xmlData, i, ">");
            if (tagData) {
              const openTagName = tagData && tagData.tagName;
              if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
                openTagCount++;
              }
              i = tagData.closeIndex;
            }
          }
        }
      }
    }
    function parseValue(val, shouldParse, options) {
      if (shouldParse && typeof val === "string") {
        const newval = val.trim();
        if (newval === "true") return true;
        else if (newval === "false") return false;
        else return toNumber(val, options);
      } else {
        if (util.isExist(val)) {
          return val;
        } else {
          return "";
        }
      }
    }
    function fromCodePoint(str, base, prefix) {
      const codePoint = Number.parseInt(str, base);
      if (codePoint >= 0 && codePoint <= 1114111) {
        return String.fromCodePoint(codePoint);
      } else {
        return prefix + str + ";";
      }
    }
    function sanitizeName(name, options) {
      if (util.criticalProperties.includes(name)) {
        throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
      } else if (util.DANGEROUS_PROPERTY_NAMES.includes(name)) {
        return options.onDangerousProperty(name);
      }
      return name;
    }
    module2.exports = OrderedObjParser;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/node2json.js
var require_node2json = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/node2json.js"(exports2) {
    "use strict";
    function prettify(node, options) {
      return compress(node, options);
    }
    function compress(arr, options, jPath) {
      let text;
      const compressedObj = {};
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const property = propName(tagObj);
        let newJpath = "";
        if (jPath === void 0) newJpath = property;
        else newJpath = jPath + "." + property;
        if (property === options.textNodeName) {
          if (text === void 0) text = tagObj[property];
          else text += "" + tagObj[property];
        } else if (property === void 0) {
          continue;
        } else if (tagObj[property]) {
          let val = compress(tagObj[property], options, newJpath);
          const isLeaf = isLeafTag(val, options);
          if (tagObj[":@"]) {
            assignAttributes(val, tagObj[":@"], newJpath, options);
          } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== void 0 && !options.alwaysCreateTextNode) {
            val = val[options.textNodeName];
          } else if (Object.keys(val).length === 0) {
            if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
            else val = "";
          }
          if (compressedObj[property] !== void 0 && compressedObj.hasOwnProperty(property)) {
            if (!Array.isArray(compressedObj[property])) {
              compressedObj[property] = [compressedObj[property]];
            }
            compressedObj[property].push(val);
          } else {
            if (options.isArray(property, newJpath, isLeaf)) {
              compressedObj[property] = [val];
            } else {
              compressedObj[property] = val;
            }
          }
        }
      }
      if (typeof text === "string") {
        if (text.length > 0) compressedObj[options.textNodeName] = text;
      } else if (text !== void 0) compressedObj[options.textNodeName] = text;
      return compressedObj;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key !== ":@") return key;
      }
    }
    function assignAttributes(obj, attrMap, jpath, options) {
      if (attrMap) {
        const keys = Object.keys(attrMap);
        const len = keys.length;
        for (let i = 0; i < len; i++) {
          const atrrName = keys[i];
          if (options.isArray(atrrName, jpath + "." + atrrName, true, true)) {
            obj[atrrName] = [attrMap[atrrName]];
          } else {
            obj[atrrName] = attrMap[atrrName];
          }
        }
      }
    }
    function isLeafTag(obj, options) {
      const { textNodeName } = options;
      const propCount = Object.keys(obj).length;
      if (propCount === 0) {
        return true;
      }
      if (propCount === 1 && (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)) {
        return true;
      }
      return false;
    }
    exports2.prettify = prettify;
  }
});

// node_modules/fast-xml-parser/src/xmlparser/XMLParser.js
var require_XMLParser = __commonJS({
  "node_modules/fast-xml-parser/src/xmlparser/XMLParser.js"(exports2, module2) {
    var { buildOptions } = require_OptionsBuilder();
    var OrderedObjParser = require_OrderedObjParser();
    var { prettify } = require_node2json();
    var validator = require_validator();
    var XMLParser2 = class {
      constructor(options) {
        this.externalEntities = {};
        this.options = buildOptions(options);
      }
      /**
       * Parse XML dats to JS object 
       * @param {string|Buffer} xmlData 
       * @param {boolean|Object} validationOption 
       */
      parse(xmlData, validationOption) {
        if (typeof xmlData === "string") {
        } else if (xmlData.toString) {
          xmlData = xmlData.toString();
        } else {
          throw new Error("XML data is accepted in String or Bytes[] form.");
        }
        if (validationOption) {
          if (validationOption === true) validationOption = {};
          const result = validator.validate(xmlData, validationOption);
          if (result !== true) {
            throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`);
          }
        }
        const orderedObjParser = new OrderedObjParser(this.options);
        orderedObjParser.addExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if (this.options.preserveOrder || orderedResult === void 0) return orderedResult;
        else return prettify(orderedResult, this.options);
      }
      /**
       * Add Entity which is not by default supported by this library
       * @param {string} key 
       * @param {string} value 
       */
      addEntity(key, value) {
        if (value.indexOf("&") !== -1) {
          throw new Error("Entity value can't have '&'");
        } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
          throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'");
        } else if (value === "&") {
          throw new Error("An entity with value '&' is not permitted");
        } else {
          this.externalEntities[key] = value;
        }
      }
    };
    module2.exports = XMLParser2;
  }
});

// node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js
var require_orderedJs2Xml = __commonJS({
  "node_modules/fast-xml-parser/src/xmlbuilder/orderedJs2Xml.js"(exports2, module2) {
    var EOL = "\n";
    function toXml(jArray, options) {
      let indentation = "";
      if (options.format && options.indentBy.length > 0) {
        indentation = EOL;
      }
      return arrToStr(jArray, options, "", indentation);
    }
    function arrToStr(arr, options, jPath, indentation) {
      let xmlStr = "";
      let isPreviousElementTag = false;
      if (!Array.isArray(arr)) {
        if (arr !== void 0 && arr !== null) {
          let text = arr.toString();
          text = replaceEntitiesValue(text, options);
          return text;
        }
        return "";
      }
      for (let i = 0; i < arr.length; i++) {
        const tagObj = arr[i];
        const tagName = propName(tagObj);
        if (tagName === void 0) continue;
        let newJPath = "";
        if (jPath.length === 0) newJPath = tagName;
        else newJPath = `${jPath}.${tagName}`;
        if (tagName === options.textNodeName) {
          let tagText = tagObj[tagName];
          if (!isStopNode(newJPath, options)) {
            tagText = options.tagValueProcessor(tagName, tagText);
            tagText = replaceEntitiesValue(tagText, options);
          }
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += tagText;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.cdataPropName) {
          if (isPreviousElementTag) {
            xmlStr += indentation;
          }
          xmlStr += `<![CDATA[${tagObj[tagName][0][options.textNodeName]}]]>`;
          isPreviousElementTag = false;
          continue;
        } else if (tagName === options.commentPropName) {
          xmlStr += indentation + `<!--${tagObj[tagName][0][options.textNodeName]}-->`;
          isPreviousElementTag = true;
          continue;
        } else if (tagName[0] === "?") {
          const attStr2 = attr_to_str(tagObj[":@"], options);
          const tempInd = tagName === "?xml" ? "" : indentation;
          let piTextNodeName = tagObj[tagName][0][options.textNodeName];
          piTextNodeName = piTextNodeName.length !== 0 ? " " + piTextNodeName : "";
          xmlStr += tempInd + `<${tagName}${piTextNodeName}${attStr2}?>`;
          isPreviousElementTag = true;
          continue;
        }
        let newIdentation = indentation;
        if (newIdentation !== "") {
          newIdentation += options.indentBy;
        }
        const attStr = attr_to_str(tagObj[":@"], options);
        const tagStart = indentation + `<${tagName}${attStr}`;
        const tagValue = arrToStr(tagObj[tagName], options, newJPath, newIdentation);
        if (options.unpairedTags.indexOf(tagName) !== -1) {
          if (options.suppressUnpairedNode) xmlStr += tagStart + ">";
          else xmlStr += tagStart + "/>";
        } else if ((!tagValue || tagValue.length === 0) && options.suppressEmptyNode) {
          xmlStr += tagStart + "/>";
        } else if (tagValue && tagValue.endsWith(">")) {
          xmlStr += tagStart + `>${tagValue}${indentation}</${tagName}>`;
        } else {
          xmlStr += tagStart + ">";
          if (tagValue && indentation !== "" && (tagValue.includes("/>") || tagValue.includes("</"))) {
            xmlStr += indentation + options.indentBy + tagValue + indentation;
          } else {
            xmlStr += tagValue;
          }
          xmlStr += `</${tagName}>`;
        }
        isPreviousElementTag = true;
      }
      return xmlStr;
    }
    function propName(obj) {
      const keys = Object.keys(obj);
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
        if (key !== ":@") return key;
      }
    }
    function attr_to_str(attrMap, options) {
      let attrStr = "";
      if (attrMap && !options.ignoreAttributes) {
        for (let attr in attrMap) {
          if (!Object.prototype.hasOwnProperty.call(attrMap, attr)) continue;
          let attrVal = options.attributeValueProcessor(attr, attrMap[attr]);
          attrVal = replaceEntitiesValue(attrVal, options);
          if (attrVal === true && options.suppressBooleanAttributes) {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}`;
          } else {
            attrStr += ` ${attr.substr(options.attributeNamePrefix.length)}="${attrVal}"`;
          }
        }
      }
      return attrStr;
    }
    function isStopNode(jPath, options) {
      jPath = jPath.substr(0, jPath.length - options.textNodeName.length - 1);
      let tagName = jPath.substr(jPath.lastIndexOf(".") + 1);
      for (let index in options.stopNodes) {
        if (options.stopNodes[index] === jPath || options.stopNodes[index] === "*." + tagName) return true;
      }
      return false;
    }
    function replaceEntitiesValue(textValue, options) {
      if (textValue && textValue.length > 0 && options.processEntities) {
        for (let i = 0; i < options.entities.length; i++) {
          const entity = options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    }
    module2.exports = toXml;
  }
});

// node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js
var require_json2xml = __commonJS({
  "node_modules/fast-xml-parser/src/xmlbuilder/json2xml.js"(exports2, module2) {
    "use strict";
    var buildFromOrderedJs = require_orderedJs2Xml();
    var getIgnoreAttributesFn = require_ignoreAttributes();
    var defaultOptions = {
      attributeNamePrefix: "@_",
      attributesGroupName: false,
      textNodeName: "#text",
      ignoreAttributes: true,
      cdataPropName: false,
      format: false,
      indentBy: "  ",
      suppressEmptyNode: false,
      suppressUnpairedNode: true,
      suppressBooleanAttributes: true,
      tagValueProcessor: function(key, a) {
        return a;
      },
      attributeValueProcessor: function(attrName, a) {
        return a;
      },
      preserveOrder: false,
      commentPropName: false,
      unpairedTags: [],
      entities: [
        { regex: new RegExp("&", "g"), val: "&amp;" },
        //it must be on top
        { regex: new RegExp(">", "g"), val: "&gt;" },
        { regex: new RegExp("<", "g"), val: "&lt;" },
        { regex: new RegExp("'", "g"), val: "&apos;" },
        { regex: new RegExp('"', "g"), val: "&quot;" }
      ],
      processEntities: true,
      stopNodes: [],
      // transformTagName: false,
      // transformAttributeName: false,
      oneListGroup: false
    };
    function Builder(options) {
      this.options = Object.assign({}, defaultOptions, options);
      if (this.options.ignoreAttributes === true || this.options.attributesGroupName) {
        this.isAttribute = function() {
          return false;
        };
      } else {
        this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes);
        this.attrPrefixLen = this.options.attributeNamePrefix.length;
        this.isAttribute = isAttribute;
      }
      this.processTextOrObjNode = processTextOrObjNode;
      if (this.options.format) {
        this.indentate = indentate;
        this.tagEndChar = ">\n";
        this.newLine = "\n";
      } else {
        this.indentate = function() {
          return "";
        };
        this.tagEndChar = ">";
        this.newLine = "";
      }
    }
    Builder.prototype.build = function(jObj) {
      if (this.options.preserveOrder) {
        return buildFromOrderedJs(jObj, this.options);
      } else {
        if (Array.isArray(jObj) && this.options.arrayNodeName && this.options.arrayNodeName.length > 1) {
          jObj = {
            [this.options.arrayNodeName]: jObj
          };
        }
        return this.j2x(jObj, 0, []).val;
      }
    };
    Builder.prototype.j2x = function(jObj, level, ajPath) {
      let attrStr = "";
      let val = "";
      const jPath = ajPath.join(".");
      for (let key in jObj) {
        if (!Object.prototype.hasOwnProperty.call(jObj, key)) continue;
        if (typeof jObj[key] === "undefined") {
          if (this.isAttribute(key)) {
            val += "";
          }
        } else if (jObj[key] === null) {
          if (this.isAttribute(key)) {
            val += "";
          } else if (key === this.options.cdataPropName) {
            val += "";
          } else if (key[0] === "?") {
            val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
          } else {
            val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
          }
        } else if (jObj[key] instanceof Date) {
          val += this.buildTextValNode(jObj[key], key, "", level);
        } else if (typeof jObj[key] !== "object") {
          const attr = this.isAttribute(key);
          if (attr && !this.ignoreAttributesFn(attr, jPath)) {
            attrStr += this.buildAttrPairStr(attr, "" + jObj[key]);
          } else if (!attr) {
            if (key === this.options.textNodeName) {
              let newval = this.options.tagValueProcessor(key, "" + jObj[key]);
              val += this.replaceEntitiesValue(newval);
            } else {
              val += this.buildTextValNode(jObj[key], key, "", level);
            }
          }
        } else if (Array.isArray(jObj[key])) {
          const arrLen = jObj[key].length;
          let listTagVal = "";
          let listTagAttr = "";
          for (let j = 0; j < arrLen; j++) {
            const item = jObj[key][j];
            if (typeof item === "undefined") {
            } else if (item === null) {
              if (key[0] === "?") val += this.indentate(level) + "<" + key + "?" + this.tagEndChar;
              else val += this.indentate(level) + "<" + key + "/" + this.tagEndChar;
            } else if (typeof item === "object") {
              if (this.options.oneListGroup) {
                const result = this.j2x(item, level + 1, ajPath.concat(key));
                listTagVal += result.val;
                if (this.options.attributesGroupName && item.hasOwnProperty(this.options.attributesGroupName)) {
                  listTagAttr += result.attrStr;
                }
              } else {
                listTagVal += this.processTextOrObjNode(item, key, level, ajPath);
              }
            } else {
              if (this.options.oneListGroup) {
                let textValue = this.options.tagValueProcessor(key, item);
                textValue = this.replaceEntitiesValue(textValue);
                listTagVal += textValue;
              } else {
                listTagVal += this.buildTextValNode(item, key, "", level);
              }
            }
          }
          if (this.options.oneListGroup) {
            listTagVal = this.buildObjectNode(listTagVal, key, listTagAttr, level);
          }
          val += listTagVal;
        } else {
          if (this.options.attributesGroupName && key === this.options.attributesGroupName) {
            const Ks = Object.keys(jObj[key]);
            const L = Ks.length;
            for (let j = 0; j < L; j++) {
              attrStr += this.buildAttrPairStr(Ks[j], "" + jObj[key][Ks[j]]);
            }
          } else {
            val += this.processTextOrObjNode(jObj[key], key, level, ajPath);
          }
        }
      }
      return { attrStr, val };
    };
    Builder.prototype.buildAttrPairStr = function(attrName, val) {
      val = this.options.attributeValueProcessor(attrName, "" + val);
      val = this.replaceEntitiesValue(val);
      if (this.options.suppressBooleanAttributes && val === "true") {
        return " " + attrName;
      } else return " " + attrName + '="' + val + '"';
    };
    function processTextOrObjNode(object, key, level, ajPath) {
      const result = this.j2x(object, level + 1, ajPath.concat(key));
      if (object[this.options.textNodeName] !== void 0 && Object.keys(object).length === 1) {
        return this.buildTextValNode(object[this.options.textNodeName], key, result.attrStr, level);
      } else {
        return this.buildObjectNode(result.val, key, result.attrStr, level);
      }
    }
    Builder.prototype.buildObjectNode = function(val, key, attrStr, level) {
      if (val === "") {
        if (key[0] === "?") return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
        else {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        }
      } else {
        let tagEndExp = "</" + key + this.tagEndChar;
        let piClosingChar = "";
        if (key[0] === "?") {
          piClosingChar = "?";
          tagEndExp = "";
        }
        if ((attrStr || attrStr === "") && val.indexOf("<") === -1) {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + ">" + val + tagEndExp;
        } else if (this.options.commentPropName !== false && key === this.options.commentPropName && piClosingChar.length === 0) {
          return this.indentate(level) + `<!--${val}-->` + this.newLine;
        } else {
          return this.indentate(level) + "<" + key + attrStr + piClosingChar + this.tagEndChar + val + this.indentate(level) + tagEndExp;
        }
      }
    };
    Builder.prototype.closeTag = function(key) {
      let closeTag = "";
      if (this.options.unpairedTags.indexOf(key) !== -1) {
        if (!this.options.suppressUnpairedNode) closeTag = "/";
      } else if (this.options.suppressEmptyNode) {
        closeTag = "/";
      } else {
        closeTag = `></${key}`;
      }
      return closeTag;
    };
    Builder.prototype.buildTextValNode = function(val, key, attrStr, level) {
      if (this.options.cdataPropName !== false && key === this.options.cdataPropName) {
        return this.indentate(level) + `<![CDATA[${val}]]>` + this.newLine;
      } else if (this.options.commentPropName !== false && key === this.options.commentPropName) {
        return this.indentate(level) + `<!--${val}-->` + this.newLine;
      } else if (key[0] === "?") {
        return this.indentate(level) + "<" + key + attrStr + "?" + this.tagEndChar;
      } else {
        let textValue = this.options.tagValueProcessor(key, val);
        textValue = this.replaceEntitiesValue(textValue);
        if (textValue === "") {
          return this.indentate(level) + "<" + key + attrStr + this.closeTag(key) + this.tagEndChar;
        } else {
          return this.indentate(level) + "<" + key + attrStr + ">" + textValue + "</" + key + this.tagEndChar;
        }
      }
    };
    Builder.prototype.replaceEntitiesValue = function(textValue) {
      if (textValue && textValue.length > 0 && this.options.processEntities) {
        for (let i = 0; i < this.options.entities.length; i++) {
          const entity = this.options.entities[i];
          textValue = textValue.replace(entity.regex, entity.val);
        }
      }
      return textValue;
    };
    function indentate(level) {
      return this.options.indentBy.repeat(level);
    }
    function isAttribute(name) {
      if (name.startsWith(this.options.attributeNamePrefix) && name !== this.options.textNodeName) {
        return name.substr(this.attrPrefixLen);
      } else {
        return false;
      }
    }
    module2.exports = Builder;
  }
});

// node_modules/fast-xml-parser/src/fxp.js
var require_fxp = __commonJS({
  "node_modules/fast-xml-parser/src/fxp.js"(exports2, module2) {
    "use strict";
    var validator = require_validator();
    var XMLParser2 = require_XMLParser();
    var XMLBuilder = require_json2xml();
    module2.exports = {
      XMLParser: XMLParser2,
      XMLValidator: validator,
      XMLBuilder
    };
  }
});

// src/main/main.ts
var import_electron2 = require("electron");
var import_node_fs3 = __toESM(require("node:fs"));
var import_node_path3 = __toESM(require("node:path"));

// src/shared/ipc.ts
var IPC = {
  watchlistGet: "watchlist:get",
  watchlistAdd: "watchlist:add",
  watchlistRemove: "watchlist:remove",
  symbolsSearch: "symbols:search",
  quotesGet: "quotes:get",
  holdingsGet: "holdings:get",
  newsGet: "news:get",
  earningsGet: "earnings:get",
  chartGet: "chart:get",
  pivotNewsGet: "chart:pivot-news",
  openExternal: "shell:open-external"
};

// src/shared/types.ts
var CHART_RANGES = ["1d", "1w", "1m", "6m", "1y", "5y", "max"];

// src/main/services/dataFiles.ts
var import_node_fs = __toESM(require("node:fs"));
var import_node_path = __toESM(require("node:path"));
function readJson(fileName) {
  try {
    const filePath = import_node_path.default.join(__dirname, "data", fileName);
    return JSON.parse(import_node_fs.default.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`[data] failed to read ${fileName}:`, err);
    return null;
  }
}
var etfBundleCache = null;
function getEtfBundle() {
  if (etfBundleCache) return etfBundleCache;
  const raw = readJson("etf-holdings.json");
  const etfs = {};
  if (raw && typeof raw === "object" && raw.etfs && typeof raw.etfs === "object") {
    for (const [symbol, entry] of Object.entries(raw.etfs)) {
      if (!entry || typeof entry.name !== "string" || !Array.isArray(entry.holdings)) continue;
      const holdings = [];
      for (const h of entry.holdings) {
        if (!h || typeof h.symbol !== "string" || typeof h.name !== "string") continue;
        holdings.push({
          symbol: h.symbol.toUpperCase(),
          name: h.name,
          weightPercent: typeof h.weightPercent === "number" ? h.weightPercent : null
        });
      }
      etfs[symbol.toUpperCase()] = { name: entry.name, holdings };
    }
  }
  etfBundleCache = {
    _meta: raw?._meta,
    etfs
  };
  return etfBundleCache;
}
function getBundleAsOf() {
  return getEtfBundle()._meta?.asOf ?? "2026-06";
}
var directoryCache = null;
function getSymbolDirectory() {
  if (directoryCache) return directoryCache;
  const raw = readJson("symbol-directory.json");
  const out = [];
  if (raw && Array.isArray(raw.symbols)) {
    for (const entry of raw.symbols) {
      const e = entry;
      if (typeof e.symbol === "string" && typeof e.name === "string" && (e.type === "etf" || e.type === "stock")) {
        out.push({
          symbol: e.symbol.toUpperCase(),
          name: e.name,
          type: e.type,
          exchange: typeof e.exchange === "string" ? e.exchange : void 0
        });
      }
    }
  }
  directoryCache = out;
  return directoryCache;
}
function directoryLookup(symbol) {
  const sym = symbol.toUpperCase();
  return getSymbolDirectory().find((e) => e.symbol === sym);
}
function lookupName(symbol) {
  const dir = directoryLookup(symbol);
  if (dir) return dir.name;
  const bundle = getEtfBundle();
  const etf = bundle.etfs[symbol.toUpperCase()];
  if (etf) return etf.name;
  for (const entry of Object.values(bundle.etfs)) {
    const hit = entry.holdings.find((h) => h.symbol === symbol.toUpperCase());
    if (hit) return hit.name;
  }
  return void 0;
}

// src/main/services/util.ts
var SYMBOL_RE = /^[A-Z0-9.^-]{1,12}$/i;
function normalizeSymbol(raw) {
  if (typeof raw !== "string") return null;
  const sym = raw.trim().toUpperCase();
  return sym.length > 0 && SYMBOL_RE.test(sym) ? sym : null;
}
function cleanSymbolList(raw, max) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    const sym = normalizeSymbol(entry);
    if (sym && !out.includes(sym)) {
      out.push(sym);
      if (out.length >= max) break;
    }
  }
  return out;
}
function fnv1a(input, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function stableHash(input) {
  return fnv1a(input);
}
function hashId(input) {
  return fnv1a(input).toString(36) + fnv1a(input, 2538058380).toString(36);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    active--;
    const run = queue.shift();
    if (run) run();
  };
  return (fn) => new Promise((resolve, reject) => {
    const run = () => {
      active++;
      fn().then(
        (value) => {
          next();
          resolve(value);
        },
        (err) => {
          next();
          reject(err);
        }
      );
    };
    if (active < concurrency) run();
    else queue.push(run);
  });
}
function toYmd(d) {
  return d.toISOString().slice(0, 10);
}
function todayYmd() {
  return toYmd(/* @__PURE__ */ new Date());
}
function parseDateMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}
function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function stripHtml(input) {
  return input.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function clampInt(raw, min, max, fallback) {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : fallback;
  return Math.min(max, Math.max(min, n));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// src/main/services/sample.ts
var BASE_PRICES = {
  SPY: 620,
  VOO: 570,
  IVV: 623,
  VTI: 305,
  QQQ: 560,
  DIA: 445,
  IWM: 225,
  XLK: 265,
  XLF: 53,
  XLE: 92,
  XLV: 135,
  SMH: 290,
  SOXX: 245,
  ARKK: 75,
  SCHD: 27,
  JEPI: 56,
  VGT: 700,
  VUG: 460,
  VTV: 175,
  RSP: 185,
  AAPL: 230,
  MSFT: 500,
  NVDA: 170,
  AMZN: 220,
  GOOGL: 185,
  GOOG: 187,
  META: 720,
  TSLA: 320,
  AVGO: 270,
  "BRK-B": 490,
  JPM: 290,
  V: 355,
  MA: 560,
  UNH: 310,
  XOM: 115,
  LLY: 780,
  JNJ: 155,
  PG: 160,
  HD: 365,
  COST: 985,
  WMT: 98,
  NFLX: 1250,
  CRM: 270,
  ORCL: 210,
  AMD: 140,
  ADBE: 390,
  PEP: 132,
  KO: 70,
  CSCO: 66,
  INTC: 22,
  TSM: 230,
  ASML: 790,
  QCOM: 155,
  TXN: 195,
  MU: 120,
  AMAT: 185,
  LRCX: 95,
  KLAC: 880,
  PLTR: 140,
  COIN: 350,
  HOOD: 80,
  SHOP: 110,
  DIS: 120,
  BA: 210,
  CAT: 390,
  GS: 700,
  MS: 140,
  BAC: 47,
  WFC: 80,
  IBM: 290,
  GE: 250,
  MCD: 300,
  NKE: 72,
  T: 28,
  VZ: 43,
  PFE: 25,
  MRK: 82,
  ABBV: 190,
  TMO: 490,
  CVX: 155,
  COP: 95,
  UBER: 90,
  NOW: 1e3,
  ISRG: 530,
  INTU: 760,
  AMGN: 290,
  HON: 220,
  GILD: 110,
  BMY: 55,
  SBUX: 95,
  PYPL: 75
};
function basePriceFor(symbol) {
  return BASE_PRICES[symbol.toUpperCase()] ?? 100;
}
var SAMPLE_RANGE = {
  "1d": { interval: "5m", count: 78, kind: "intraday", stepSec: 300, vol: 12e-4, baseVolume: 9e5 },
  "1w": { interval: "15m", count: 130, kind: "intraday", stepSec: 900, vol: 2e-3, baseVolume: 26e5 },
  "1m": { interval: "60m", count: 154, kind: "intraday", stepSec: 3600, vol: 4e-3, baseVolume: 9e6 },
  "6m": { interval: "1d", count: 126, kind: "daily", stepSec: 86400, vol: 0.012, baseVolume: 55e6 },
  "1y": { interval: "1d", count: 252, kind: "daily", stepSec: 86400, vol: 0.012, baseVolume: 55e6 },
  "5y": { interval: "1wk", count: 260, kind: "weekly", stepSec: 7 * 86400, vol: 0.028, baseVolume: 26e7 },
  max: { interval: "1mo", count: 240, kind: "monthly", stepSec: 30 * 86400, vol: 0.05, baseVolume: 11e8 }
};
var SESSION_OPEN_SEC = 13.5 * 3600;
var SESSION_CLOSE_SEC = 20 * 3600;
function lastWeekdayUtc(fromMs) {
  const d = new Date(fromMs);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return Math.floor(d.getTime() / 1e3);
}
function buildTimes(spec, count) {
  const times = [];
  if (spec.kind === "intraday") {
    let day = lastWeekdayUtc(Date.now());
    while (times.length < count) {
      const dayBars = [];
      for (let t = SESSION_OPEN_SEC; t < SESSION_CLOSE_SEC; t += spec.stepSec) {
        dayBars.push(day + t);
      }
      times.unshift(...dayBars);
      day = lastWeekdayUtc((day - 86400) * 1e3);
    }
    return times.slice(times.length - count);
  }
  if (spec.kind === "daily") {
    let day = lastWeekdayUtc(Date.now());
    while (times.length < count) {
      times.unshift(day + SESSION_OPEN_SEC);
      day = lastWeekdayUtc((day - 86400) * 1e3);
    }
    return times;
  }
  if (spec.kind === "weekly") {
    const anchor = lastWeekdayUtc(Date.now());
    for (let i = count - 1; i >= 0; i--) {
      times.push(anchor - i * 7 * 86400 + SESSION_OPEN_SEC);
    }
    return times;
  }
  const d = /* @__PURE__ */ new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(1);
  for (let i = 0; i < count; i++) {
    times.unshift(Math.floor(d.getTime() / 1e3) + SESSION_OPEN_SEC);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return times;
}
function sampleChart(symbol, range) {
  const sym = symbol.toUpperCase();
  const spec = SAMPLE_RANGE[range];
  const rng = mulberry32(stableHash(`${sym}|${range}`));
  const base = basePriceFor(sym);
  const times = buildTimes(spec, spec.count);
  const n = times.length;
  const closes = new Array(n);
  closes[n - 1] = base;
  for (let i = n - 2; i >= 0; i--) {
    const drift = (rng() - 0.495) * 2 * spec.vol;
    closes[i] = closes[i + 1] / (1 + drift);
  }
  const candles = [];
  let prevClose = closes[0] * (1 + (rng() - 0.5) * spec.vol);
  for (let i = 0; i < n; i++) {
    const open = prevClose;
    const close = closes[i];
    const wick = Math.max(Math.abs(close - open), close * spec.vol * 0.5);
    const high = Math.max(open, close) + rng() * wick * 0.6;
    const low = Math.min(open, close) - rng() * wick * 0.6;
    candles.push({
      time: times[i],
      open: round2(open),
      high: round2(high),
      low: round2(Math.max(low, 0.01)),
      close: round2(close),
      volume: Math.round(spec.baseVolume * (0.4 + rng() * 1.2))
    });
    prevClose = close;
  }
  const previousClose = range === "1d" ? round2(candles[0].open) : round2(candles[Math.max(0, n - 2)].close);
  return {
    symbol: sym,
    range,
    interval: spec.interval,
    candles,
    currency: "USD",
    exchangeName: void 0,
    regularMarketPrice: round2(candles[n - 1].close),
    previousClose,
    source: "sample"
  };
}
function sampleQuote(symbol) {
  const sym = symbol.toUpperCase();
  const chart = sampleChart(sym, "1d");
  const last = chart.candles[chart.candles.length - 1];
  const price = last.close;
  const previousClose = chart.previousClose ?? null;
  const change = previousClose !== null ? round2(price - previousClose) : null;
  const changePercent = previousClose !== null && previousClose !== 0 && change !== null ? round2(change / previousClose * 100) : null;
  return {
    symbol: sym,
    price,
    change,
    changePercent,
    previousClose,
    currency: "USD",
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: "sample"
  };
}
var NEWS_TEMPLATES = [
  (name) => `${name} in focus as investors weigh the sector outlook`,
  (name, sym) => `Analysts revisit ${name} (${sym}) price targets after recent moves`,
  (name, sym) => `What the latest market swings mean for ${sym} holders`,
  (name) => `${name}: three things to watch this quarter`
];
function sampleNews(symbols, perSymbol = 3) {
  const items2 = [];
  const nowHour = Math.floor(Date.now() / 36e5) * 36e5;
  for (const symbol of symbols.slice(0, 12)) {
    const sym = symbol.toUpperCase();
    const rng = mulberry32(stableHash(`news|${sym}`));
    const name = lookupName(sym) ?? sym;
    for (let i = 0; i < Math.min(perSymbol, NEWS_TEMPLATES.length); i++) {
      const ageHours = 2 + Math.floor(rng() * 20) + i * 24;
      items2.push({
        id: `sample-${sym.toLowerCase()}-${i}`,
        title: NEWS_TEMPLATES[i](name, sym),
        url: `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`,
        sourceName: "Sample Data",
        publishedAt: new Date(nowHour - ageHours * 36e5).toISOString(),
        relatedSymbol: sym,
        summary: "Offline sample headline \u2014 live news was unavailable when this was generated."
      });
    }
  }
  items2.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return items2;
}
function sampleEarnings(symbol) {
  const sym = symbol.toUpperCase();
  const hash = stableHash(sym);
  const daysOut = hash % 28 + 2;
  const date = /* @__PURE__ */ new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + daysOut);
  return {
    symbol: sym,
    companyName: lookupName(sym) ?? sym,
    date: toYmd(date),
    time: hash % 2 === 0 ? "bmo" : "amc",
    epsEstimate: null,
    source: "sample"
  };
}

// src/main/services/cache.ts
var TtlCache = class {
  constructor(maxEntries = 800) {
    this.maxEntries = maxEntries;
  }
  map = /* @__PURE__ */ new Map();
  get(key) {
    const entry = this.map.get(key);
    if (!entry) return void 0;
    if (entry.expires <= Date.now()) {
      this.map.delete(key);
      return void 0;
    }
    return entry.value;
  }
  set(key, value, ttlMs) {
    if (ttlMs <= 0) return;
    if (this.map.size >= this.maxEntries) this.prune();
    this.map.set(key, { expires: Date.now() + ttlMs, value });
  }
  delete(key) {
    this.map.delete(key);
  }
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expires <= now) this.map.delete(key);
    }
    while (this.map.size >= this.maxEntries) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      this.map.delete(oldest.value);
    }
  }
};

// src/main/services/http.ts
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
var HttpError = class extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
};
var DEFAULT_TIMEOUT_MS = 12e3;
var MAX_ATTEMPTS = 3;
var RETRY_DELAYS_MS = [500, 1400];
var HostLimiter = class {
  constructor(maxConcurrent, spacingMs) {
    this.maxConcurrent = maxConcurrent;
    this.spacingMs = spacingMs;
  }
  active = 0;
  nextSlot = 0;
  waiting = [];
  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  acquire() {
    return new Promise((resolve) => {
      const attempt = () => {
        if (this.active >= this.maxConcurrent) {
          this.waiting.push(attempt);
          return;
        }
        const now = Date.now();
        const wait = this.nextSlot - now;
        if (wait > 0) {
          setTimeout(attempt, wait);
          return;
        }
        this.active++;
        this.nextSlot = now + this.spacingMs;
        resolve();
      };
      attempt();
    });
  }
  release() {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
};
var limiters = /* @__PURE__ */ new Map();
function limiterFor(host) {
  let limiter = limiters.get(host);
  if (!limiter) {
    const spacing = host === "query1.finance.yahoo.com" ? 250 : 0;
    limiter = new HostLimiter(4, spacing);
    limiters.set(host, limiter);
  }
  return limiter;
}
var bodyCache = new TtlCache(600);
var inFlight = /* @__PURE__ */ new Map();
async function doFetch(url, host, headers, timeoutMs) {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, ...headers },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) {
    throw new HttpError(`HTTP ${res.status} from ${host}`, res.status);
  }
  return res.text();
}
async function fetchWithRetry(url, headers, timeoutMs) {
  const host = new URL(url).hostname;
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await limiterFor(host).run(() => doFetch(url, host, headers, timeoutMs));
    } catch (err) {
      lastErr = err;
      const status = err instanceof HttpError ? err.status : void 0;
      const retryable = status === void 0 || status === 429 || status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS - 1) throw err;
      await sleep(RETRY_DELAYS_MS[attempt] ?? 1500);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}
async function fetchText(url, opts = {}) {
  const ttlMs = opts.ttlMs ?? 0;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (ttlMs > 0) {
    const cached = bodyCache.get(url);
    if (cached !== void 0) return cached;
    const pending = inFlight.get(url);
    if (pending) return pending;
  }
  const promise = fetchWithRetry(url, opts.headers, timeoutMs).then((body) => {
    if (ttlMs > 0) bodyCache.set(url, body, ttlMs);
    return body;
  }).finally(() => {
    inFlight.delete(url);
  });
  if (ttlMs > 0) inFlight.set(url, promise);
  return promise;
}
async function fetchJson(url, opts = {}) {
  const body = await fetchText(url, opts);
  try {
    return JSON.parse(body);
  } catch {
    bodyCache.delete(url);
    throw new Error(`Invalid JSON from ${new URL(url).hostname}`);
  }
}

// src/main/services/yahoo.ts
function rawNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value && typeof value === "object") {
    const raw = value.raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  }
  return null;
}
async function fetchYahooChart(symbol, yahooRange, interval, ttlMs) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(yahooRange)}&interval=${encodeURIComponent(interval)}&includePrePost=false`;
  const json = await fetchJson(url, { ttlMs });
  const result = json.chart?.result?.[0];
  if (!result || !result.meta) {
    const desc = json.chart?.error?.description ?? "empty chart result";
    throw new Error(`Yahoo chart failed for ${symbol}: ${desc}`);
  }
  return result;
}
async function searchYahoo(query) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=8&newsCount=0`;
  const json = await fetchJson(url, { ttlMs: 10 * 6e4 });
  return Array.isArray(json.quotes) ? json.quotes : [];
}
var CRUMB_TTL_MS = 30 * 6e4;
var crumbState = null;
var crumbPromise = null;
function invalidateCrumb() {
  crumbState = null;
}
async function fetchCookie() {
  const res = await fetch("https://fc.yahoo.com/", {
    headers: { "User-Agent": BROWSER_UA },
    redirect: "manual",
    signal: AbortSignal.timeout(12e3)
  });
  let cookies = [];
  try {
    cookies = res.headers.getSetCookie();
  } catch {
  }
  if (cookies.length === 0) {
    const single = res.headers.get("set-cookie");
    if (single) cookies = [single];
  }
  const parts = cookies.map((c) => c.split(";")[0].trim()).filter((c) => c.includes("="));
  if (parts.length === 0) throw new Error("Yahoo returned no cookie");
  return parts.join("; ");
}
async function fetchCrumbState() {
  const cookie = await fetchCookie();
  const res = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": BROWSER_UA, Cookie: cookie },
    signal: AbortSignal.timeout(12e3)
  });
  if (!res.ok) throw new HttpError(`getcrumb HTTP ${res.status}`, res.status);
  const crumb = (await res.text()).trim();
  if (!crumb || crumb.length > 64 || crumb.includes("<") || crumb.includes("{")) {
    throw new Error("Yahoo returned an invalid crumb");
  }
  return { cookie, crumb, fetchedAt: Date.now() };
}
async function getCrumb(force = false) {
  if (force) invalidateCrumb();
  if (crumbState && Date.now() - crumbState.fetchedAt < CRUMB_TTL_MS) {
    return crumbState;
  }
  if (!crumbPromise) {
    crumbPromise = fetchCrumbState().then((state) => {
      crumbState = state;
      return state;
    }).finally(() => {
      crumbPromise = null;
    });
  }
  return crumbPromise;
}
async function quoteSummary(symbol, modules) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie, crumb } = await getCrumb(attempt > 0);
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${encodeURIComponent(modules.join(","))}&crumb=${encodeURIComponent(crumb)}`;
    try {
      const json = await fetchJson(url, {
        ttlMs: 0,
        headers: { Cookie: cookie }
      });
      const result = json.quoteSummary?.result?.[0];
      if (!result) {
        const desc = json.quoteSummary?.error?.description ?? "empty result";
        throw new Error(`quoteSummary failed for ${symbol}: ${desc}`);
      }
      return result;
    } catch (err) {
      lastErr = err;
      const status = err instanceof HttpError ? err.status : void 0;
      if ((status === 401 || status === 403) && attempt === 0) {
        invalidateCrumb();
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`quoteSummary failed for ${symbol}`);
}

// src/main/services/chart.ts
var INTRADAY_TTL = 6e4;
var DAILY_TTL = 10 * 6e4;
var RANGE_MAP = {
  "1d": { yahooRange: "1d", interval: "5m", ttlMs: INTRADAY_TTL },
  "1w": { yahooRange: "5d", interval: "15m", ttlMs: INTRADAY_TTL },
  "1m": { yahooRange: "1mo", interval: "60m", ttlMs: INTRADAY_TTL },
  "6m": { yahooRange: "6mo", interval: "1d", ttlMs: DAILY_TTL },
  "1y": { yahooRange: "1y", interval: "1d", ttlMs: DAILY_TTL },
  "5y": { yahooRange: "5y", interval: "1wk", ttlMs: DAILY_TTL },
  max: { yahooRange: "max", interval: "1mo", ttlMs: DAILY_TTL }
};
function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}
async function getChart(symbol, range) {
  const spec = RANGE_MAP[range];
  try {
    const result = await fetchYahooChart(symbol, spec.yahooRange, spec.interval, spec.ttlMs);
    const meta = result.meta ?? {};
    const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens = quote.open ?? [];
    const highs = quote.high ?? [];
    const lows = quote.low ?? [];
    const closes = quote.close ?? [];
    const volumes = quote.volume ?? [];
    const bySecond = /* @__PURE__ */ new Map();
    for (let i = 0; i < timestamps.length; i++) {
      const time = timestamps[i];
      const close = closes[i];
      if (!isFiniteNumber(time) || !isFiniteNumber(close)) continue;
      const rawOpen = opens[i];
      const rawHigh = highs[i];
      const rawLow = lows[i];
      const rawVolume = volumes[i];
      const open = isFiniteNumber(rawOpen) ? rawOpen : close;
      let high = isFiniteNumber(rawHigh) ? rawHigh : Math.max(open, close);
      let low = isFiniteNumber(rawLow) ? rawLow : Math.min(open, close);
      high = Math.max(high, open, close);
      low = Math.min(low, open, close);
      const volume = isFiniteNumber(rawVolume) ? rawVolume : 0;
      bySecond.set(Math.floor(time), { time: Math.floor(time), open, high, low, close, volume });
    }
    const candles = [...bySecond.values()].sort((a, b) => a.time - b.time);
    if (candles.length === 0) throw new Error(`no usable candles for ${symbol} ${range}`);
    return {
      symbol,
      range,
      interval: spec.interval,
      candles,
      currency: typeof meta.currency === "string" && meta.currency ? meta.currency : "USD",
      exchangeName: typeof meta.exchangeName === "string" && meta.exchangeName ? meta.exchangeName : void 0,
      regularMarketPrice: isFiniteNumber(meta.regularMarketPrice) ? meta.regularMarketPrice : null,
      previousClose: isFiniteNumber(meta.chartPreviousClose) ? meta.chartPreviousClose : isFiniteNumber(meta.previousClose) ? meta.previousClose : null,
      source: "live"
    };
  } catch {
    return sampleChart(symbol, range);
  }
}

// src/main/services/earnings.ts
var LIVE_TTL_MS = 6 * 60 * 6e4;
var SAMPLE_TTL_MS = 10 * 6e4;
var WINDOW_DAYS = 120;
var limit = pLimit(3);
var cache = new TtlCache(400);
function toEpochMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1e3;
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  if (value && typeof value === "object") {
    const raw = value.raw;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw > 1e12 ? raw : raw * 1e3;
    }
    const fmt = value.fmt;
    if (typeof fmt === "string") {
      const ms = Date.parse(fmt);
      return Number.isNaN(ms) ? null : ms;
    }
  }
  return null;
}
function detectTime(candidates) {
  for (const c of candidates) {
    if (typeof c !== "string") continue;
    const v = c.toLowerCase();
    if (v.includes("bmo") || v.includes("before")) return "bmo";
    if (v.includes("amc") || v.includes("after")) return "amc";
  }
  return "unknown";
}
async function fetchLiveEvent(symbol) {
  const summary = await quoteSummary(symbol, ["calendarEvents", "price"]);
  const earnings = summary.calendarEvents?.earnings;
  const companyName = summary.price?.longName || summary.price?.shortName || lookupName(symbol) || symbol;
  const dates = Array.isArray(earnings?.earningsDate) ? earnings.earningsDate : [];
  const startOfToday = Date.parse(`${toYmd(/* @__PURE__ */ new Date())}T00:00:00Z`);
  const windowEnd = startOfToday + WINDOW_DAYS * 864e5;
  let nextMs = null;
  for (const d of dates) {
    const ms = toEpochMs(d);
    if (ms === null || ms < startOfToday || ms > windowEnd) continue;
    if (nextMs === null || ms < nextMs) nextMs = ms;
  }
  if (nextMs === null) return null;
  return {
    symbol,
    companyName,
    date: toYmd(new Date(nextMs)),
    time: detectTime([earnings?.earningsCallTime, earnings?.callTime]),
    epsEstimate: rawNumber(earnings?.earningsAverage),
    source: "live"
  };
}
async function eventFor(symbol) {
  const cached = cache.get(symbol);
  if (cached !== void 0) return cached;
  try {
    const event = await limit(() => fetchLiveEvent(symbol));
    cache.set(symbol, event, LIVE_TTL_MS);
    return event;
  } catch {
    const event = sampleEarnings(symbol);
    cache.set(symbol, event, SAMPLE_TTL_MS);
    return event;
  }
}
async function getEarnings(symbols) {
  const results = await Promise.all(symbols.map((s) => eventFor(s)));
  const events = results.filter((e) => e !== null);
  events.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
  return events;
}

// src/main/services/holdings.ts
var LIVE_TTL_MS2 = 12 * 60 * 6e4;
var SAMPLE_TTL_MS2 = 15 * 6e4;
var MAX_HOLDINGS = 20;
var cache2 = new TtlCache(200);
var inFlight2 = /* @__PURE__ */ new Map();
function bundledResult(etfSymbol) {
  const entry = getEtfBundle().etfs[etfSymbol];
  return {
    etfSymbol,
    asOf: getBundleAsOf(),
    holdings: entry ? entry.holdings.slice(0, MAX_HOLDINGS) : [],
    source: "sample"
  };
}
async function fetchLiveHoldings(etfSymbol) {
  const summary = await quoteSummary(etfSymbol, ["topHoldings"]);
  const raw = summary.topHoldings?.holdings;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`no live topHoldings for ${etfSymbol}`);
  }
  const out = [];
  for (const h of raw) {
    const symbol = typeof h.symbol === "string" ? h.symbol.toUpperCase().trim() : "";
    if (!symbol || out.some((x) => x.symbol === symbol)) continue;
    const fraction = rawNumber(h.holdingPercent);
    out.push({
      symbol,
      name: typeof h.holdingName === "string" && h.holdingName ? h.holdingName : symbol,
      weightPercent: fraction === null ? null : round2(fraction * 100)
    });
  }
  if (out.length === 0) throw new Error(`unusable live topHoldings for ${etfSymbol}`);
  return out;
}
function mergeWithBundle(etfSymbol, live) {
  const merged = [...live];
  const bundle = getEtfBundle().etfs[etfSymbol];
  if (bundle) {
    for (const h of bundle.holdings) {
      if (merged.length >= MAX_HOLDINGS) break;
      if (merged.some((x) => x.symbol === h.symbol)) continue;
      merged.push(h);
    }
    for (const item of merged) {
      if (item.name === item.symbol) {
        const known = bundle.holdings.find((x) => x.symbol === item.symbol);
        if (known) item.name = known.name;
      }
    }
  }
  merged.sort((a, b) => (b.weightPercent ?? -1) - (a.weightPercent ?? -1));
  return merged.slice(0, MAX_HOLDINGS);
}
async function getHoldings(etfSymbol) {
  const sym = etfSymbol.toUpperCase();
  const cached = cache2.get(sym);
  if (cached) return cached;
  const pending = inFlight2.get(sym);
  if (pending) return pending;
  const promise = (async () => {
    try {
      const live = await fetchLiveHoldings(sym);
      const result = {
        etfSymbol: sym,
        asOf: todayYmd(),
        holdings: mergeWithBundle(sym, live),
        source: "live"
      };
      cache2.set(sym, result, LIVE_TTL_MS2);
      return result;
    } catch {
      const result = bundledResult(sym);
      cache2.set(sym, result, SAMPLE_TTL_MS2);
      return result;
    }
  })().finally(() => {
    inFlight2.delete(sym);
  });
  inFlight2.set(sym, promise);
  return promise;
}

// src/main/services/rss.ts
var import_fast_xml_parser = __toESM(require_fxp());
var parser = new import_fast_xml_parser.XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "item",
  parseTagValue: false,
  trimValues: true
});
function textOf(value) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const text = value["#text"];
    if (typeof text === "string") return text.trim();
    if (typeof text === "number") return String(text);
  }
  return "";
}
function parseRssItems(xml) {
  let doc;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }
  const channel = doc.rss?.channel;
  const rawItems = channel?.item;
  if (!Array.isArray(rawItems)) return [];
  const out = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw;
    const title = textOf(item.title);
    const link = textOf(item.link);
    if (!title || !link) continue;
    const pubDate = textOf(item.pubDate);
    const description = textOf(item.description);
    const sourceName = textOf(item.source);
    out.push({
      title,
      link,
      pubDate: pubDate || void 0,
      description: description || void 0,
      sourceName: sourceName || void 0
    });
  }
  return out;
}

// src/main/services/news.ts
var FEED_TTL_MS = 10 * 6e4;
var MAX_SYMBOLS = 40;
var MAX_TOTAL = 100;
var limit2 = pLimit(4);
async function fetchSymbolFeed(symbol) {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  const xml = await fetchText(url, { ttlMs: FEED_TTL_MS });
  const items2 = parseRssItems(xml);
  const out = [];
  for (const item of items2) {
    const publishedMs = parseDateMs(item.pubDate);
    const summary = item.description ? stripHtml(item.description).slice(0, 300) : void 0;
    out.push({
      id: `y-${hashId(`${item.link}|${item.title}`)}`,
      title: item.title,
      url: item.link,
      sourceName: item.sourceName || "Yahoo Finance",
      publishedAt: new Date(publishedMs ?? Date.now()).toISOString(),
      relatedSymbol: symbol,
      summary: summary && summary !== item.title ? summary : void 0
    });
  }
  return out;
}
async function getNews(symbols, limitPerSymbol = 6) {
  const requested = symbols.slice(0, MAX_SYMBOLS);
  if (requested.length === 0) return [];
  const perSymbol = await Promise.all(
    requested.map(
      (symbol) => limit2(() => fetchSymbolFeed(symbol)).catch(() => null)
    )
  );
  const allFailed = perSymbol.every((r) => r === null);
  if (allFailed) return sampleNews(requested);
  const seenTitles = /* @__PURE__ */ new Set();
  const merged = [];
  for (const feed of perSymbol) {
    if (!feed) continue;
    for (const item of feed.slice(0, limitPerSymbol)) {
      const key = normalizeTitle(item.title);
      if (!key || seenTitles.has(key)) continue;
      seenTitles.add(key);
      merged.push(item);
    }
  }
  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return merged.slice(0, MAX_TOTAL);
}

// src/main/services/googleNews.ts
function cleanTitle(title, publisher) {
  const idx = title.lastIndexOf(" - ");
  if (idx <= 0) return title;
  const suffix = title.slice(idx + 3).trim();
  if (publisher && suffix.toLowerCase() === publisher.toLowerCase()) {
    return title.slice(0, idx).trim();
  }
  if (!publisher && suffix.length <= 40 && !suffix.includes(" - ")) {
    return title.slice(0, idx).trim();
  }
  return title;
}
async function searchGoogleNews(symbol, afterYmd, beforeYmd, ttlMs) {
  const query = `${symbol} stock after:${afterYmd} before:${beforeYmd}`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await fetchText(url, { ttlMs });
  const items2 = parseRssItems(xml);
  const out = [];
  for (const item of items2) {
    const publishedMs = parseDateMs(item.pubDate);
    if (publishedMs === null) continue;
    const publisher = item.sourceName;
    out.push({
      id: `g-${hashId(`${item.link}|${item.title}`)}`,
      title: cleanTitle(item.title, publisher),
      url: item.link,
      sourceName: publisher || "Google News",
      publishedAt: new Date(publishedMs).toISOString(),
      relatedSymbol: symbol
    });
  }
  return out;
}

// src/main/services/pivotNews.ts
var WINDOW_DAYS2 = 5;
var DAY_MS = 864e5;
var GOOGLE_TTL_MS = 30 * 6e4;
var MAX_ITEMS_PER_PIVOT = 4;
var MAX_PIVOTS = 12;
var limit3 = pLimit(3);
async function newsForPivot(symbol, pivot, yahooItems) {
  const pivotMs = pivot.time * 1e3;
  const startMs = pivotMs - WINDOW_DAYS2 * DAY_MS;
  let endMs = pivotMs + WINDOW_DAYS2 * DAY_MS;
  const nowMs = Date.now();
  if (endMs > nowMs) endMs = nowMs;
  const afterYmd = toYmd(new Date(Math.min(startMs, endMs - DAY_MS)));
  const beforeYmd = toYmd(new Date(endMs));
  const google = await searchGoogleNews(symbol, afterYmd, beforeYmd, GOOGLE_TTL_MS).catch(
    () => []
  );
  const inWindow = (item) => {
    const ms = Date.parse(item.publishedAt);
    return !Number.isNaN(ms) && ms >= startMs - DAY_MS && ms <= endMs + DAY_MS;
  };
  const merged = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of [...google, ...yahooItems.filter(inWindow)]) {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  merged.sort(
    (a, b) => Math.abs(Date.parse(a.publishedAt) - pivotMs) - Math.abs(Date.parse(b.publishedAt) - pivotMs)
  );
  return merged.slice(0, MAX_ITEMS_PER_PIVOT);
}
async function getPivotNews(symbol, pivots) {
  const bounded = pivots.slice(0, MAX_PIVOTS);
  if (bounded.length === 0) return [];
  const yahooItems = await fetchSymbolFeed(symbol).catch(() => []);
  const results = await Promise.all(
    bounded.map(
      (pivot) => limit3(() => newsForPivot(symbol, pivot, yahooItems)).catch(() => []).then((items2) => ({ pivot, items: items2 }))
    )
  );
  return results;
}

// src/main/services/quotes.ts
var QUOTE_TTL_MS = 45e3;
var limit4 = pLimit(4);
async function fetchQuote(symbol) {
  const result = await fetchYahooChart(symbol, "1d", "5m", QUOTE_TTL_MS);
  const meta = result.meta ?? {};
  const price = typeof meta.regularMarketPrice === "number" && Number.isFinite(meta.regularMarketPrice) ? meta.regularMarketPrice : null;
  const prevRaw = meta.chartPreviousClose ?? meta.previousClose;
  const previousClose = typeof prevRaw === "number" && Number.isFinite(prevRaw) ? prevRaw : null;
  let change = null;
  let changePercent = null;
  if (price !== null && previousClose !== null) {
    change = round2(price - previousClose);
    changePercent = previousClose !== 0 ? round2(change / previousClose * 100) : null;
  }
  return {
    symbol,
    price,
    change,
    changePercent,
    previousClose,
    currency: typeof meta.currency === "string" && meta.currency ? meta.currency : "USD",
    marketState: typeof meta.marketState === "string" && meta.marketState ? meta.marketState : void 0,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    source: "live"
  };
}
async function getQuotes(symbols) {
  return Promise.all(
    symbols.map(
      (symbol) => limit4(() => fetchQuote(symbol)).catch(() => sampleQuote(symbol))
    )
  );
}

// src/main/services/symbols.ts
var MAX_RESULTS = 8;
function mapQuoteType(quoteType) {
  const t = (quoteType ?? "").toUpperCase();
  if (t === "ETF") return "etf";
  if (t === "EQUITY") return "stock";
  return null;
}
function searchDirectory(query) {
  const q = query.trim().toUpperCase();
  if (!q) return [];
  const qLower = query.trim().toLowerCase();
  const dir = getSymbolDirectory();
  const scored = dir.map((entry) => {
    let score = -1;
    if (entry.symbol === q) score = 3;
    else if (entry.symbol.startsWith(q)) score = 2;
    else if (entry.name.toLowerCase().includes(qLower)) score = 1;
    return { entry, score };
  }).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.entry.symbol.localeCompare(b.entry.symbol));
  return scored.slice(0, MAX_RESULTS).map(({ entry }) => ({
    symbol: entry.symbol,
    name: entry.name,
    type: entry.type,
    exchange: entry.exchange
  }));
}
async function searchSymbols(query) {
  const q = query.trim().slice(0, 48);
  if (!q) return [];
  try {
    const quotes = await searchYahoo(q);
    const out = [];
    for (const quote of quotes) {
      const type = mapQuoteType(quote.quoteType);
      if (!type) continue;
      const symbol = typeof quote.symbol === "string" ? quote.symbol.toUpperCase() : "";
      if (!symbol || out.some((s) => s.symbol === symbol)) continue;
      out.push({
        symbol,
        name: quote.longname || quote.shortname || symbol,
        type,
        exchange: quote.exchDisp || void 0
      });
      if (out.length >= MAX_RESULTS) break;
    }
    return out.length > 0 ? out : searchDirectory(q);
  } catch {
    return searchDirectory(q);
  }
}

// src/main/services/watchlistStore.ts
var import_electron = require("electron");
var import_node_fs2 = __toESM(require("node:fs"));
var import_node_path2 = __toESM(require("node:path"));
var SEED = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "etf" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", type: "etf" },
  { symbol: "SMH", name: "VanEck Semiconductor ETF", type: "etf" },
  { symbol: "AAPL", name: "Apple Inc.", type: "stock" },
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "stock" },
  { symbol: "TSLA", name: "Tesla, Inc.", type: "stock" }
];
var items = null;
function storePath() {
  return import_node_path2.default.join(import_electron.app.getPath("userData"), "watchlist.json");
}
function seedItems() {
  const addedAt = (/* @__PURE__ */ new Date()).toISOString();
  return SEED.map((s) => ({ ...s, addedAt }));
}
function isValidItem(value) {
  if (!value || typeof value !== "object") return false;
  const item = value;
  return typeof item.symbol === "string" && normalizeSymbol(item.symbol) !== null && typeof item.name === "string" && item.name.length > 0 && (item.type === "etf" || item.type === "stock") && typeof item.addedAt === "string";
}
function save(list) {
  try {
    const file = storePath();
    import_node_fs2.default.mkdirSync(import_node_path2.default.dirname(file), { recursive: true });
    import_node_fs2.default.writeFileSync(file, JSON.stringify(list, null, 2), "utf8");
  } catch (err) {
    console.error("[watchlist] failed to persist:", err);
  }
}
function load() {
  if (items) return items;
  try {
    const raw = import_node_fs2.default.readFileSync(storePath(), "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isValidItem).map((item) => ({
        ...item,
        symbol: item.symbol.toUpperCase()
      }));
      if (valid.length > 0 || parsed.length === 0) {
        items = valid;
        return items;
      }
    }
    throw new Error("unrecognized watchlist file shape");
  } catch (err) {
    const code = err.code;
    if (code !== "ENOENT") console.error("[watchlist] reseeding after load error:", err);
    items = seedItems();
    save(items);
    return items;
  }
}
function getWatchlist() {
  return [...load()];
}
function removeFromWatchlist(symbol) {
  const sym = symbol.toUpperCase();
  const list = load().filter((item) => item.symbol !== sym);
  items = list;
  save(list);
  return [...list];
}
async function resolveSymbol(symbol) {
  try {
    const suggestions = await searchSymbols(symbol);
    const exact = suggestions.find((s) => s.symbol.toUpperCase() === symbol);
    if (exact) return { name: exact.name, type: exact.type };
  } catch {
  }
  const entry = directoryLookup(symbol);
  if (entry) return { name: entry.name, type: entry.type };
  return null;
}
async function addToWatchlist(rawSymbol) {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) return { ok: false, error: "Invalid symbol" };
  const list = load();
  if (list.some((item2) => item2.symbol === symbol)) {
    return { ok: false, error: "Already in watchlist" };
  }
  const resolved = await resolveSymbol(symbol);
  if (!resolved) return { ok: false, error: "Symbol not found" };
  const item = {
    symbol,
    name: resolved.name,
    type: resolved.type,
    addedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  const next = [...list, item];
  items = next;
  save(next);
  return { ok: true, item, watchlist: [...next] };
}

// src/main/main.ts
var MAX_QUOTE_SYMBOLS = 60;
var MAX_NEWS_SYMBOLS = 40;
var MAX_EARNINGS_SYMBOLS = 60;
var MAX_PIVOTS2 = 12;
var isSmoke = process.argv.includes("--smoke");
var smokeModalArg = process.argv.find((arg) => arg.startsWith("--smoke-modal="));
var smokeModalSymbol = smokeModalArg ? normalizeSymbol(smokeModalArg.slice("--smoke-modal=".length)) : null;
function cleanPivots(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry;
    if (typeof p.time !== "number" || !Number.isFinite(p.time)) continue;
    if (typeof p.price !== "number" || !Number.isFinite(p.price)) continue;
    if (p.kind !== "high" && p.kind !== "low") continue;
    out.push({ time: p.time, price: p.price, kind: p.kind });
    if (out.length >= MAX_PIVOTS2) break;
  }
  return out;
}
function cleanRange(raw) {
  return CHART_RANGES.includes(raw) ? raw : "6m";
}
function registerIpcHandlers() {
  import_electron2.ipcMain.handle(IPC.watchlistGet, () => {
    try {
      return getWatchlist();
    } catch {
      return [];
    }
  });
  import_electron2.ipcMain.handle(IPC.watchlistAdd, async (_e, rawSymbol) => {
    try {
      if (typeof rawSymbol !== "string") return { ok: false, error: "Invalid symbol" };
      return await addToWatchlist(rawSymbol);
    } catch {
      return { ok: false, error: "Could not add symbol" };
    }
  });
  import_electron2.ipcMain.handle(IPC.watchlistRemove, (_e, rawSymbol) => {
    try {
      const symbol = normalizeSymbol(rawSymbol);
      return symbol ? removeFromWatchlist(symbol) : getWatchlist();
    } catch {
      return [];
    }
  });
  import_electron2.ipcMain.handle(IPC.symbolsSearch, async (_e, rawQuery) => {
    try {
      if (typeof rawQuery !== "string") return [];
      return await searchSymbols(rawQuery);
    } catch {
      return [];
    }
  });
  import_electron2.ipcMain.handle(IPC.quotesGet, async (_e, rawSymbols) => {
    const symbols = cleanSymbolList(rawSymbols, MAX_QUOTE_SYMBOLS);
    try {
      return await getQuotes(symbols);
    } catch {
      return symbols.map((s) => sampleQuote(s));
    }
  });
  import_electron2.ipcMain.handle(IPC.holdingsGet, async (_e, rawSymbol) => {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) {
      return { etfSymbol: "", asOf: todayYmd(), holdings: [], source: "sample" };
    }
    try {
      return await getHoldings(symbol);
    } catch {
      return { etfSymbol: symbol, asOf: todayYmd(), holdings: [], source: "sample" };
    }
  });
  import_electron2.ipcMain.handle(IPC.newsGet, async (_e, rawSymbols, rawLimit) => {
    const symbols = cleanSymbolList(rawSymbols, MAX_NEWS_SYMBOLS);
    const limitPerSymbol = clampInt(rawLimit, 1, 20, 6);
    try {
      return await getNews(symbols, limitPerSymbol);
    } catch {
      return sampleNews(symbols);
    }
  });
  import_electron2.ipcMain.handle(IPC.earningsGet, async (_e, rawSymbols) => {
    const symbols = cleanSymbolList(rawSymbols, MAX_EARNINGS_SYMBOLS);
    try {
      return await getEarnings(symbols);
    } catch {
      return symbols.map((s) => sampleEarnings(s));
    }
  });
  import_electron2.ipcMain.handle(IPC.chartGet, async (_e, rawSymbol, rawRange) => {
    const symbol = normalizeSymbol(rawSymbol) ?? "SPY";
    const range = cleanRange(rawRange);
    try {
      return await getChart(symbol, range);
    } catch {
      return sampleChart(symbol, range);
    }
  });
  import_electron2.ipcMain.handle(IPC.pivotNewsGet, async (_e, rawSymbol, rawPivots) => {
    const pivots = cleanPivots(rawPivots);
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol) return pivots.map((pivot) => ({ pivot, items: [] }));
    try {
      return await getPivotNews(symbol, pivots);
    } catch {
      return pivots.map((pivot) => ({ pivot, items: [] }));
    }
  });
  import_electron2.ipcMain.handle(IPC.openExternal, async (_e, rawUrl) => {
    if (typeof rawUrl !== "string") return;
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return;
    try {
      await import_electron2.shell.openExternal(parsed.toString());
    } catch (err) {
      console.error("[shell] openExternal failed:", err);
    }
  });
}
function armSmokeMode(win) {
  win.setIgnoreMouseEvents(true);
  win.setFocusable(false);
  win.webContents.on("console-message", (_event, _level, message) => {
    console.log("[renderer] " + message);
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    console.error("[renderer] process gone: " + details.reason);
  });
  win.webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) console.log("[smoke] main-frame navigation: " + url);
  });
  const killer = setTimeout(() => {
    console.error("SMOKE_FAIL hard timeout after 45s");
    import_electron2.app.exit(1);
  }, 45e3);
  killer.unref();
  win.webContents.once("did-finish-load", () => {
    const envDelay = Number(process.env.QUANT_SMOKE_DELAY_MS);
    const delayMs = Number.isFinite(envDelay) && envDelay > 0 ? Math.min(envDelay, 4e4) : smokeModalSymbol ? 16e3 : 13e3;
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
        const outPath = process.env.QUANT_SMOKE_OUT || import_node_path3.default.join(
          import_electron2.app.getAppPath(),
          smokeModalSymbol ? "dist/smoke-modal.png" : "dist/smoke.png"
        );
        import_node_fs3.default.mkdirSync(import_node_path3.default.dirname(outPath), { recursive: true });
        import_node_fs3.default.writeFileSync(outPath, image.toPNG());
        clearTimeout(killer);
        console.log("SMOKE_OK " + outPath);
        import_electron2.app.quit();
      } catch (err) {
        console.error("SMOKE_FAIL", err);
        process.exitCode = 1;
        import_electron2.app.quit();
      }
    }, delayMs);
  });
}
var mainWindow = null;
function createWindow() {
  const win = new import_electron2.BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: "#0a0e16",
    autoHideMenuBar: true,
    title: "Quant",
    webPreferences: {
      preload: import_node_path3.default.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  if (isSmoke) armSmokeMode(win);
  const indexPath = import_node_path3.default.join(__dirname, "../renderer/index.html");
  if (smokeModalSymbol) {
    void win.loadFile(indexPath, { query: { smokeModal: smokeModalSymbol } });
  } else {
    void win.loadFile(indexPath);
  }
}
var gotLock = import_electron2.app.requestSingleInstanceLock();
if (!gotLock) {
  import_electron2.app.quit();
} else {
  import_electron2.app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[main] unhandled rejection:", reason);
  });
  import_electron2.app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();
    import_electron2.app.on("activate", () => {
      if (import_electron2.BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
  import_electron2.app.on("window-all-closed", () => {
    import_electron2.app.quit();
  });
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vbm9kZV9tb2R1bGVzL2Zhc3QteG1sLXBhcnNlci9zcmMvdXRpbC5qcyIsICIuLi8uLi9ub2RlX21vZHVsZXMvZmFzdC14bWwtcGFyc2VyL3NyYy92YWxpZGF0b3IuanMiLCAiLi4vLi4vbm9kZV9tb2R1bGVzL2Zhc3QteG1sLXBhcnNlci9zcmMveG1scGFyc2VyL09wdGlvbnNCdWlsZGVyLmpzIiwgIi4uLy4uL25vZGVfbW9kdWxlcy9mYXN0LXhtbC1wYXJzZXIvc3JjL3htbHBhcnNlci94bWxOb2RlLmpzIiwgIi4uLy4uL25vZGVfbW9kdWxlcy9mYXN0LXhtbC1wYXJzZXIvc3JjL3htbHBhcnNlci9Eb2NUeXBlUmVhZGVyLmpzIiwgIi4uLy4uL25vZGVfbW9kdWxlcy9zdHJudW0vc3RybnVtLmpzIiwgIi4uLy4uL25vZGVfbW9kdWxlcy9mYXN0LXhtbC1wYXJzZXIvc3JjL2lnbm9yZUF0dHJpYnV0ZXMuanMiLCAiLi4vLi4vbm9kZV9tb2R1bGVzL2Zhc3QteG1sLXBhcnNlci9zcmMveG1scGFyc2VyL09yZGVyZWRPYmpQYXJzZXIuanMiLCAiLi4vLi4vbm9kZV9tb2R1bGVzL2Zhc3QteG1sLXBhcnNlci9zcmMveG1scGFyc2VyL25vZGUyanNvbi5qcyIsICIuLi8uLi9ub2RlX21vZHVsZXMvZmFzdC14bWwtcGFyc2VyL3NyYy94bWxwYXJzZXIvWE1MUGFyc2VyLmpzIiwgIi4uLy4uL25vZGVfbW9kdWxlcy9mYXN0LXhtbC1wYXJzZXIvc3JjL3htbGJ1aWxkZXIvb3JkZXJlZEpzMlhtbC5qcyIsICIuLi8uLi9ub2RlX21vZHVsZXMvZmFzdC14bWwtcGFyc2VyL3NyYy94bWxidWlsZGVyL2pzb24yeG1sLmpzIiwgIi4uLy4uL25vZGVfbW9kdWxlcy9mYXN0LXhtbC1wYXJzZXIvc3JjL2Z4cC5qcyIsICIuLi8uLi9zcmMvbWFpbi9tYWluLnRzIiwgIi4uLy4uL3NyYy9zaGFyZWQvaXBjLnRzIiwgIi4uLy4uL3NyYy9zaGFyZWQvdHlwZXMudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvZGF0YUZpbGVzLnRzIiwgIi4uLy4uL3NyYy9tYWluL3NlcnZpY2VzL3V0aWwudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvc2FtcGxlLnRzIiwgIi4uLy4uL3NyYy9tYWluL3NlcnZpY2VzL2NhY2hlLnRzIiwgIi4uLy4uL3NyYy9tYWluL3NlcnZpY2VzL2h0dHAudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMveWFob28udHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvY2hhcnQudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvZWFybmluZ3MudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvaG9sZGluZ3MudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvcnNzLnRzIiwgIi4uLy4uL3NyYy9tYWluL3NlcnZpY2VzL25ld3MudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvZ29vZ2xlTmV3cy50cyIsICIuLi8uLi9zcmMvbWFpbi9zZXJ2aWNlcy9waXZvdE5ld3MudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvcXVvdGVzLnRzIiwgIi4uLy4uL3NyYy9tYWluL3NlcnZpY2VzL3N5bWJvbHMudHMiLCAiLi4vLi4vc3JjL21haW4vc2VydmljZXMvd2F0Y2hsaXN0U3RvcmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIid1c2Ugc3RyaWN0JztcblxuY29uc3QgbmFtZVN0YXJ0Q2hhciA9ICc6QS1aYS16X1xcXFx1MDBDMC1cXFxcdTAwRDZcXFxcdTAwRDgtXFxcXHUwMEY2XFxcXHUwMEY4LVxcXFx1MDJGRlxcXFx1MDM3MC1cXFxcdTAzN0RcXFxcdTAzN0YtXFxcXHUxRkZGXFxcXHUyMDBDLVxcXFx1MjAwRFxcXFx1MjA3MC1cXFxcdTIxOEZcXFxcdTJDMDAtXFxcXHUyRkVGXFxcXHUzMDAxLVxcXFx1RDdGRlxcXFx1RjkwMC1cXFxcdUZEQ0ZcXFxcdUZERjAtXFxcXHVGRkZEJztcbmNvbnN0IG5hbWVDaGFyID0gbmFtZVN0YXJ0Q2hhciArICdcXFxcLS5cXFxcZFxcXFx1MDBCN1xcXFx1MDMwMC1cXFxcdTAzNkZcXFxcdTIwM0YtXFxcXHUyMDQwJztcbmNvbnN0IG5hbWVSZWdleHAgPSAnWycgKyBuYW1lU3RhcnRDaGFyICsgJ11bJyArIG5hbWVDaGFyICsgJ10qJ1xuY29uc3QgcmVnZXhOYW1lID0gbmV3IFJlZ0V4cCgnXicgKyBuYW1lUmVnZXhwICsgJyQnKTtcblxuY29uc3QgZ2V0QWxsTWF0Y2hlcyA9IGZ1bmN0aW9uIChzdHJpbmcsIHJlZ2V4KSB7XG4gIGNvbnN0IG1hdGNoZXMgPSBbXTtcbiAgbGV0IG1hdGNoID0gcmVnZXguZXhlYyhzdHJpbmcpO1xuICB3aGlsZSAobWF0Y2gpIHtcbiAgICBjb25zdCBhbGxtYXRjaGVzID0gW107XG4gICAgYWxsbWF0Y2hlcy5zdGFydEluZGV4ID0gcmVnZXgubGFzdEluZGV4IC0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgIGNvbnN0IGxlbiA9IG1hdGNoLmxlbmd0aDtcbiAgICBmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbGVuOyBpbmRleCsrKSB7XG4gICAgICBhbGxtYXRjaGVzLnB1c2gobWF0Y2hbaW5kZXhdKTtcbiAgICB9XG4gICAgbWF0Y2hlcy5wdXNoKGFsbG1hdGNoZXMpO1xuICAgIG1hdGNoID0gcmVnZXguZXhlYyhzdHJpbmcpO1xuICB9XG4gIHJldHVybiBtYXRjaGVzO1xufTtcblxuY29uc3QgaXNOYW1lID0gZnVuY3Rpb24gKHN0cmluZykge1xuICBjb25zdCBtYXRjaCA9IHJlZ2V4TmFtZS5leGVjKHN0cmluZyk7XG4gIHJldHVybiAhKG1hdGNoID09PSBudWxsIHx8IHR5cGVvZiBtYXRjaCA9PT0gJ3VuZGVmaW5lZCcpO1xufTtcblxuZXhwb3J0cy5pc0V4aXN0ID0gZnVuY3Rpb24gKHYpIHtcbiAgcmV0dXJuIHR5cGVvZiB2ICE9PSAndW5kZWZpbmVkJztcbn07XG5cbmV4cG9ydHMuaXNFbXB0eU9iamVjdCA9IGZ1bmN0aW9uIChvYmopIHtcbiAgcmV0dXJuIE9iamVjdC5rZXlzKG9iaikubGVuZ3RoID09PSAwO1xufTtcblxuLyoqXG4gKiBDb3B5IGFsbCB0aGUgcHJvcGVydGllcyBvZiBhIGludG8gYi5cbiAqIEBwYXJhbSB7Kn0gdGFyZ2V0XG4gKiBAcGFyYW0geyp9IGFcbiAqL1xuZXhwb3J0cy5tZXJnZSA9IGZ1bmN0aW9uICh0YXJnZXQsIGEsIGFycmF5TW9kZSkge1xuICBpZiAoYSkge1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhhKTsgLy8gd2lsbCByZXR1cm4gYW4gYXJyYXkgb2Ygb3duIHByb3BlcnRpZXNcbiAgICBjb25zdCBsZW4gPSBrZXlzLmxlbmd0aDsgLy9kb24ndCBtYWtlIGl0IGlubGluZVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmIChhcnJheU1vZGUgPT09ICdzdHJpY3QnKSB7XG4gICAgICAgIHRhcmdldFtrZXlzW2ldXSA9IFthW2tleXNbaV1dXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhcmdldFtrZXlzW2ldXSA9IGFba2V5c1tpXV07XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuLyogZXhwb3J0cy5tZXJnZSA9ZnVuY3Rpb24gKGIsYSl7XG4gIHJldHVybiBPYmplY3QuYXNzaWduKGIsYSk7XG59ICovXG5cbmV4cG9ydHMuZ2V0VmFsdWUgPSBmdW5jdGlvbiAodikge1xuICBpZiAoZXhwb3J0cy5pc0V4aXN0KHYpKSB7XG4gICAgcmV0dXJuIHY7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG59O1xuXG4vKipcbiAqIERhbmdlcm91cyBwcm9wZXJ0eSBuYW1lcyB0aGF0IGNvdWxkIGxlYWQgdG8gcHJvdG90eXBlIHBvbGx1dGlvbiBvciBzZWN1cml0eSBpc3N1ZXNcbiAqL1xuY29uc3QgREFOR0VST1VTX1BST1BFUlRZX05BTUVTID0gW1xuICAvLyAnX19wcm90b19fJyxcbiAgLy8gJ2NvbnN0cnVjdG9yJyxcbiAgLy8gJ3Byb3RvdHlwZScsXG4gICdoYXNPd25Qcm9wZXJ0eScsXG4gICd0b1N0cmluZycsXG4gICd2YWx1ZU9mJyxcbiAgJ19fZGVmaW5lR2V0dGVyX18nLFxuICAnX19kZWZpbmVTZXR0ZXJfXycsXG4gICdfX2xvb2t1cEdldHRlcl9fJyxcbiAgJ19fbG9va3VwU2V0dGVyX18nXG5dO1xuXG5jb25zdCBjcml0aWNhbFByb3BlcnRpZXMgPSBbXCJfX3Byb3RvX19cIiwgXCJjb25zdHJ1Y3RvclwiLCBcInByb3RvdHlwZVwiXTtcblxuZXhwb3J0cy5pc05hbWUgPSBpc05hbWU7XG5leHBvcnRzLmdldEFsbE1hdGNoZXMgPSBnZXRBbGxNYXRjaGVzO1xuZXhwb3J0cy5uYW1lUmVnZXhwID0gbmFtZVJlZ2V4cDtcbmV4cG9ydHMuREFOR0VST1VTX1BST1BFUlRZX05BTUVTID0gREFOR0VST1VTX1BST1BFUlRZX05BTUVTO1xuZXhwb3J0cy5jcml0aWNhbFByb3BlcnRpZXMgPSBjcml0aWNhbFByb3BlcnRpZXM7XG4iLCAiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCB1dGlsID0gcmVxdWlyZSgnLi91dGlsJyk7XG5cbmNvbnN0IGRlZmF1bHRPcHRpb25zID0ge1xuICBhbGxvd0Jvb2xlYW5BdHRyaWJ1dGVzOiBmYWxzZSwgLy9BIHRhZyBjYW4gaGF2ZSBhdHRyaWJ1dGVzIHdpdGhvdXQgYW55IHZhbHVlXG4gIHVucGFpcmVkVGFnczogW11cbn07XG5cbi8vY29uc3QgdGFnc1BhdHRlcm4gPSBuZXcgUmVnRXhwKFwiPFxcXFwvPyhbXFxcXHc6XFxcXC1fXFwuXSspXFxcXHMqXFwvPz5cIixcImdcIik7XG5leHBvcnRzLnZhbGlkYXRlID0gZnVuY3Rpb24gKHhtbERhdGEsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcblxuICAvL3htbERhdGEgPSB4bWxEYXRhLnJlcGxhY2UoLyhcXHJcXG58XFxufFxccikvZ20sXCJcIik7Ly9tYWtlIGl0IHNpbmdsZSBsaW5lXG4gIC8veG1sRGF0YSA9IHhtbERhdGEucmVwbGFjZSgvKF5cXHMqPFxcP3htbC4qP1xcPz4pL2csXCJcIik7Ly9SZW1vdmUgWE1MIHN0YXJ0aW5nIHRhZ1xuICAvL3htbERhdGEgPSB4bWxEYXRhLnJlcGxhY2UoLyg8IURPQ1RZUEVbXFxzXFx3XFxcIlxcLlxcL1xcLVxcOl0rKFxcWy4qXFxdKSpcXHMqPikvZyxcIlwiKTsvL1JlbW92ZSBET0NUWVBFXG4gIGNvbnN0IHRhZ3MgPSBbXTtcbiAgbGV0IHRhZ0ZvdW5kID0gZmFsc2U7XG5cbiAgLy9pbmRpY2F0ZXMgdGhhdCB0aGUgcm9vdCB0YWcgaGFzIGJlZW4gY2xvc2VkIChha2EuIGRlcHRoIDAgaGFzIGJlZW4gcmVhY2hlZClcbiAgbGV0IHJlYWNoZWRSb290ID0gZmFsc2U7XG5cbiAgaWYgKHhtbERhdGFbMF0gPT09ICdcXHVmZWZmJykge1xuICAgIC8vIGNoZWNrIGZvciBieXRlIG9yZGVyIG1hcmsgKEJPTSlcbiAgICB4bWxEYXRhID0geG1sRGF0YS5zdWJzdHIoMSk7XG4gIH1cbiAgXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuXG4gICAgaWYgKHhtbERhdGFbaV0gPT09ICc8JyAmJiB4bWxEYXRhW2krMV0gPT09ICc/Jykge1xuICAgICAgaSs9MjtcbiAgICAgIGkgPSByZWFkUEkoeG1sRGF0YSxpKTtcbiAgICAgIGlmIChpLmVycikgcmV0dXJuIGk7XG4gICAgfWVsc2UgaWYgKHhtbERhdGFbaV0gPT09ICc8Jykge1xuICAgICAgLy9zdGFydGluZyBvZiB0YWdcbiAgICAgIC8vcmVhZCB1bnRpbCB5b3UgcmVhY2ggdG8gJz4nIGF2b2lkaW5nIGFueSAnPicgaW4gYXR0cmlidXRlIHZhbHVlXG4gICAgICBsZXQgdGFnU3RhcnRQb3MgPSBpO1xuICAgICAgaSsrO1xuICAgICAgXG4gICAgICBpZiAoeG1sRGF0YVtpXSA9PT0gJyEnKSB7XG4gICAgICAgIGkgPSByZWFkQ29tbWVudEFuZENEQVRBKHhtbERhdGEsIGkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxldCBjbG9zaW5nVGFnID0gZmFsc2U7XG4gICAgICAgIGlmICh4bWxEYXRhW2ldID09PSAnLycpIHtcbiAgICAgICAgICAvL2Nsb3NpbmcgdGFnXG4gICAgICAgICAgY2xvc2luZ1RhZyA9IHRydWU7XG4gICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIC8vcmVhZCB0YWduYW1lXG4gICAgICAgIGxldCB0YWdOYW1lID0gJyc7XG4gICAgICAgIGZvciAoOyBpIDwgeG1sRGF0YS5sZW5ndGggJiZcbiAgICAgICAgICB4bWxEYXRhW2ldICE9PSAnPicgJiZcbiAgICAgICAgICB4bWxEYXRhW2ldICE9PSAnICcgJiZcbiAgICAgICAgICB4bWxEYXRhW2ldICE9PSAnXFx0JyAmJlxuICAgICAgICAgIHhtbERhdGFbaV0gIT09ICdcXG4nICYmXG4gICAgICAgICAgeG1sRGF0YVtpXSAhPT0gJ1xccic7IGkrK1xuICAgICAgICApIHtcbiAgICAgICAgICB0YWdOYW1lICs9IHhtbERhdGFbaV07XG4gICAgICAgIH1cbiAgICAgICAgdGFnTmFtZSA9IHRhZ05hbWUudHJpbSgpO1xuICAgICAgICAvL2NvbnNvbGUubG9nKHRhZ05hbWUpO1xuXG4gICAgICAgIGlmICh0YWdOYW1lW3RhZ05hbWUubGVuZ3RoIC0gMV0gPT09ICcvJykge1xuICAgICAgICAgIC8vc2VsZiBjbG9zaW5nIHRhZyB3aXRob3V0IGF0dHJpYnV0ZXNcbiAgICAgICAgICB0YWdOYW1lID0gdGFnTmFtZS5zdWJzdHJpbmcoMCwgdGFnTmFtZS5sZW5ndGggLSAxKTtcbiAgICAgICAgICAvL2NvbnRpbnVlO1xuICAgICAgICAgIGktLTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXZhbGlkYXRlVGFnTmFtZSh0YWdOYW1lKSkge1xuICAgICAgICAgIGxldCBtc2c7XG4gICAgICAgICAgaWYgKHRhZ05hbWUudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgbXNnID0gXCJJbnZhbGlkIHNwYWNlIGFmdGVyICc8Jy5cIjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbXNnID0gXCJUYWcgJ1wiK3RhZ05hbWUrXCInIGlzIGFuIGludmFsaWQgbmFtZS5cIjtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIGdldEVycm9yT2JqZWN0KCdJbnZhbGlkVGFnJywgbXNnLCBnZXRMaW5lTnVtYmVyRm9yUG9zaXRpb24oeG1sRGF0YSwgaSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gcmVhZEF0dHJpYnV0ZVN0cih4bWxEYXRhLCBpKTtcbiAgICAgICAgaWYgKHJlc3VsdCA9PT0gZmFsc2UpIHtcbiAgICAgICAgICByZXR1cm4gZ2V0RXJyb3JPYmplY3QoJ0ludmFsaWRBdHRyJywgXCJBdHRyaWJ1dGVzIGZvciAnXCIrdGFnTmFtZStcIicgaGF2ZSBvcGVuIHF1b3RlLlwiLCBnZXRMaW5lTnVtYmVyRm9yUG9zaXRpb24oeG1sRGF0YSwgaSkpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBhdHRyU3RyID0gcmVzdWx0LnZhbHVlO1xuICAgICAgICBpID0gcmVzdWx0LmluZGV4O1xuXG4gICAgICAgIGlmIChhdHRyU3RyW2F0dHJTdHIubGVuZ3RoIC0gMV0gPT09ICcvJykge1xuICAgICAgICAgIC8vc2VsZiBjbG9zaW5nIHRhZ1xuICAgICAgICAgIGNvbnN0IGF0dHJTdHJTdGFydCA9IGkgLSBhdHRyU3RyLmxlbmd0aDtcbiAgICAgICAgICBhdHRyU3RyID0gYXR0clN0ci5zdWJzdHJpbmcoMCwgYXR0clN0ci5sZW5ndGggLSAxKTtcbiAgICAgICAgICBjb25zdCBpc1ZhbGlkID0gdmFsaWRhdGVBdHRyaWJ1dGVTdHJpbmcoYXR0clN0ciwgb3B0aW9ucyk7XG4gICAgICAgICAgaWYgKGlzVmFsaWQgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHRhZ0ZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICAgIC8vY29udGludWU7IC8vdGV4dCBtYXkgcHJlc2VudHMgYWZ0ZXIgc2VsZiBjbG9zaW5nIHRhZ1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL3RoZSByZXN1bHQgZnJvbSB0aGUgbmVzdGVkIGZ1bmN0aW9uIHJldHVybnMgdGhlIHBvc2l0aW9uIG9mIHRoZSBlcnJvciB3aXRoaW4gdGhlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgLy9pbiBvcmRlciB0byBnZXQgdGhlICd0cnVlJyBlcnJvciBsaW5lLCB3ZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgcG9zaXRpb24gd2hlcmUgdGhlIGF0dHJpYnV0ZSBiZWdpbnMgKGkgLSBhdHRyU3RyLmxlbmd0aCkgYW5kIHRoZW4gYWRkIHRoZSBwb3NpdGlvbiB3aXRoaW4gdGhlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgLy90aGlzIGdpdmVzIHVzIHRoZSBhYnNvbHV0ZSBpbmRleCBpbiB0aGUgZW50aXJlIHhtbCwgd2hpY2ggd2UgY2FuIHVzZSB0byBmaW5kIHRoZSBsaW5lIGF0IGxhc3RcbiAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdChpc1ZhbGlkLmVyci5jb2RlLCBpc1ZhbGlkLmVyci5tc2csIGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCBhdHRyU3RyU3RhcnQgKyBpc1ZhbGlkLmVyci5saW5lKSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGNsb3NpbmdUYWcpIHtcbiAgICAgICAgICBpZiAoIXJlc3VsdC50YWdDbG9zZWQpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZFRhZycsIFwiQ2xvc2luZyB0YWcgJ1wiK3RhZ05hbWUrXCInIGRvZXNuJ3QgaGF2ZSBwcm9wZXIgY2xvc2luZy5cIiwgZ2V0TGluZU51bWJlckZvclBvc2l0aW9uKHhtbERhdGEsIGkpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKGF0dHJTdHIudHJpbSgpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZFRhZycsIFwiQ2xvc2luZyB0YWcgJ1wiK3RhZ05hbWUrXCInIGNhbid0IGhhdmUgYXR0cmlidXRlcyBvciBpbnZhbGlkIHN0YXJ0aW5nLlwiLCBnZXRMaW5lTnVtYmVyRm9yUG9zaXRpb24oeG1sRGF0YSwgdGFnU3RhcnRQb3MpKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gZ2V0RXJyb3JPYmplY3QoJ0ludmFsaWRUYWcnLCBcIkNsb3NpbmcgdGFnICdcIit0YWdOYW1lK1wiJyBoYXMgbm90IGJlZW4gb3BlbmVkLlwiLCBnZXRMaW5lTnVtYmVyRm9yUG9zaXRpb24oeG1sRGF0YSwgdGFnU3RhcnRQb3MpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3Qgb3RnID0gdGFncy5wb3AoKTtcbiAgICAgICAgICAgIGlmICh0YWdOYW1lICE9PSBvdGcudGFnTmFtZSkge1xuICAgICAgICAgICAgICBsZXQgb3BlblBvcyA9IGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCBvdGcudGFnU3RhcnRQb3MpO1xuICAgICAgICAgICAgICByZXR1cm4gZ2V0RXJyb3JPYmplY3QoJ0ludmFsaWRUYWcnLFxuICAgICAgICAgICAgICAgIFwiRXhwZWN0ZWQgY2xvc2luZyB0YWcgJ1wiK290Zy50YWdOYW1lK1wiJyAob3BlbmVkIGluIGxpbmUgXCIrb3BlblBvcy5saW5lK1wiLCBjb2wgXCIrb3BlblBvcy5jb2wrXCIpIGluc3RlYWQgb2YgY2xvc2luZyB0YWcgJ1wiK3RhZ05hbWUrXCInLlwiLFxuICAgICAgICAgICAgICAgIGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCB0YWdTdGFydFBvcykpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvL3doZW4gdGhlcmUgYXJlIG5vIG1vcmUgdGFncywgd2UgcmVhY2hlZCB0aGUgcm9vdCBsZXZlbC5cbiAgICAgICAgICAgIGlmICh0YWdzLmxlbmd0aCA9PSAwKSB7XG4gICAgICAgICAgICAgIHJlYWNoZWRSb290ID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaXNWYWxpZCA9IHZhbGlkYXRlQXR0cmlidXRlU3RyaW5nKGF0dHJTdHIsIG9wdGlvbnMpO1xuICAgICAgICAgIGlmIChpc1ZhbGlkICE9PSB0cnVlKSB7XG4gICAgICAgICAgICAvL3RoZSByZXN1bHQgZnJvbSB0aGUgbmVzdGVkIGZ1bmN0aW9uIHJldHVybnMgdGhlIHBvc2l0aW9uIG9mIHRoZSBlcnJvciB3aXRoaW4gdGhlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgLy9pbiBvcmRlciB0byBnZXQgdGhlICd0cnVlJyBlcnJvciBsaW5lLCB3ZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgcG9zaXRpb24gd2hlcmUgdGhlIGF0dHJpYnV0ZSBiZWdpbnMgKGkgLSBhdHRyU3RyLmxlbmd0aCkgYW5kIHRoZW4gYWRkIHRoZSBwb3NpdGlvbiB3aXRoaW4gdGhlIGF0dHJpYnV0ZVxuICAgICAgICAgICAgLy90aGlzIGdpdmVzIHVzIHRoZSBhYnNvbHV0ZSBpbmRleCBpbiB0aGUgZW50aXJlIHhtbCwgd2hpY2ggd2UgY2FuIHVzZSB0byBmaW5kIHRoZSBsaW5lIGF0IGxhc3RcbiAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdChpc1ZhbGlkLmVyci5jb2RlLCBpc1ZhbGlkLmVyci5tc2csIGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCBpIC0gYXR0clN0ci5sZW5ndGggKyBpc1ZhbGlkLmVyci5saW5lKSk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy9pZiB0aGUgcm9vdCBsZXZlbCBoYXMgYmVlbiByZWFjaGVkIGJlZm9yZSAuLi5cbiAgICAgICAgICBpZiAocmVhY2hlZFJvb3QgPT09IHRydWUpIHtcbiAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZFhtbCcsICdNdWx0aXBsZSBwb3NzaWJsZSByb290IG5vZGVzIGZvdW5kLicsIGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCBpKSk7XG4gICAgICAgICAgfSBlbHNlIGlmKG9wdGlvbnMudW5wYWlyZWRUYWdzLmluZGV4T2YodGFnTmFtZSkgIT09IC0xKXtcbiAgICAgICAgICAgIC8vZG9uJ3QgcHVzaCBpbnRvIHN0YWNrXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRhZ3MucHVzaCh7dGFnTmFtZSwgdGFnU3RhcnRQb3N9KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGFnRm91bmQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9za2lwIHRhZyB0ZXh0IHZhbHVlXG4gICAgICAgIC8vSXQgbWF5IGluY2x1ZGUgY29tbWVudHMgYW5kIENEQVRBIHZhbHVlXG4gICAgICAgIGZvciAoaSsrOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICh4bWxEYXRhW2ldID09PSAnPCcpIHtcbiAgICAgICAgICAgIGlmICh4bWxEYXRhW2kgKyAxXSA9PT0gJyEnKSB7XG4gICAgICAgICAgICAgIC8vY29tbWVudCBvciBDQURBVEFcbiAgICAgICAgICAgICAgaSsrO1xuICAgICAgICAgICAgICBpID0gcmVhZENvbW1lbnRBbmRDREFUQSh4bWxEYXRhLCBpKTtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHhtbERhdGFbaSsxXSA9PT0gJz8nKSB7XG4gICAgICAgICAgICAgIGkgPSByZWFkUEkoeG1sRGF0YSwgKytpKTtcbiAgICAgICAgICAgICAgaWYgKGkuZXJyKSByZXR1cm4gaTtcbiAgICAgICAgICAgIH0gZWxzZXtcbiAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmICh4bWxEYXRhW2ldID09PSAnJicpIHtcbiAgICAgICAgICAgIGNvbnN0IGFmdGVyQW1wID0gdmFsaWRhdGVBbXBlcnNhbmQoeG1sRGF0YSwgaSk7XG4gICAgICAgICAgICBpZiAoYWZ0ZXJBbXAgPT0gLTEpXG4gICAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZENoYXInLCBcImNoYXIgJyYnIGlzIG5vdCBleHBlY3RlZC5cIiwgZ2V0TGluZU51bWJlckZvclBvc2l0aW9uKHhtbERhdGEsIGkpKTtcbiAgICAgICAgICAgIGkgPSBhZnRlckFtcDtcbiAgICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIGlmIChyZWFjaGVkUm9vdCA9PT0gdHJ1ZSAmJiAhaXNXaGl0ZVNwYWNlKHhtbERhdGFbaV0pKSB7XG4gICAgICAgICAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZFhtbCcsIFwiRXh0cmEgdGV4dCBhdCB0aGUgZW5kXCIsIGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCBpKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IC8vZW5kIG9mIHJlYWRpbmcgdGFnIHRleHQgdmFsdWVcbiAgICAgICAgaWYgKHhtbERhdGFbaV0gPT09ICc8Jykge1xuICAgICAgICAgIGktLTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoIGlzV2hpdGVTcGFjZSh4bWxEYXRhW2ldKSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZENoYXInLCBcImNoYXIgJ1wiK3htbERhdGFbaV0rXCInIGlzIG5vdCBleHBlY3RlZC5cIiwgZ2V0TGluZU51bWJlckZvclBvc2l0aW9uKHhtbERhdGEsIGkpKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIXRhZ0ZvdW5kKSB7XG4gICAgcmV0dXJuIGdldEVycm9yT2JqZWN0KCdJbnZhbGlkWG1sJywgJ1N0YXJ0IHRhZyBleHBlY3RlZC4nLCAxKTtcbiAgfWVsc2UgaWYgKHRhZ3MubGVuZ3RoID09IDEpIHtcbiAgICAgIHJldHVybiBnZXRFcnJvck9iamVjdCgnSW52YWxpZFRhZycsIFwiVW5jbG9zZWQgdGFnICdcIit0YWdzWzBdLnRhZ05hbWUrXCInLlwiLCBnZXRMaW5lTnVtYmVyRm9yUG9zaXRpb24oeG1sRGF0YSwgdGFnc1swXS50YWdTdGFydFBvcykpO1xuICB9ZWxzZSBpZiAodGFncy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4gZ2V0RXJyb3JPYmplY3QoJ0ludmFsaWRYbWwnLCBcIkludmFsaWQgJ1wiK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHRhZ3MubWFwKHQgPT4gdC50YWdOYW1lKSwgbnVsbCwgNCkucmVwbGFjZSgvXFxyP1xcbi9nLCAnJykrXG4gICAgICAgICAgXCInIGZvdW5kLlwiLCB7bGluZTogMSwgY29sOiAxfSk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbmZ1bmN0aW9uIGlzV2hpdGVTcGFjZShjaGFyKXtcbiAgcmV0dXJuIGNoYXIgPT09ICcgJyB8fCBjaGFyID09PSAnXFx0JyB8fCBjaGFyID09PSAnXFxuJyAgfHwgY2hhciA9PT0gJ1xccic7XG59XG4vKipcbiAqIFJlYWQgUHJvY2Vzc2luZyBpbnNzdHJ1Y3Rpb25zIGFuZCBza2lwXG4gKiBAcGFyYW0geyp9IHhtbERhdGFcbiAqIEBwYXJhbSB7Kn0gaVxuICovXG5mdW5jdGlvbiByZWFkUEkoeG1sRGF0YSwgaSkge1xuICBjb25zdCBzdGFydCA9IGk7XG4gIGZvciAoOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh4bWxEYXRhW2ldID09ICc/JyB8fCB4bWxEYXRhW2ldID09ICcgJykge1xuICAgICAgLy90YWduYW1lXG4gICAgICBjb25zdCB0YWduYW1lID0geG1sRGF0YS5zdWJzdHIoc3RhcnQsIGkgLSBzdGFydCk7XG4gICAgICBpZiAoaSA+IDUgJiYgdGFnbmFtZSA9PT0gJ3htbCcpIHtcbiAgICAgICAgcmV0dXJuIGdldEVycm9yT2JqZWN0KCdJbnZhbGlkWG1sJywgJ1hNTCBkZWNsYXJhdGlvbiBhbGxvd2VkIG9ubHkgYXQgdGhlIHN0YXJ0IG9mIHRoZSBkb2N1bWVudC4nLCBnZXRMaW5lTnVtYmVyRm9yUG9zaXRpb24oeG1sRGF0YSwgaSkpO1xuICAgICAgfSBlbHNlIGlmICh4bWxEYXRhW2ldID09ICc/JyAmJiB4bWxEYXRhW2kgKyAxXSA9PSAnPicpIHtcbiAgICAgICAgLy9jaGVjayBpZiB2YWxpZCBhdHRyaWJ1dCBzdHJpbmdcbiAgICAgICAgaSsrO1xuICAgICAgICBicmVhaztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gaTtcbn1cblxuZnVuY3Rpb24gcmVhZENvbW1lbnRBbmRDREFUQSh4bWxEYXRhLCBpKSB7XG4gIGlmICh4bWxEYXRhLmxlbmd0aCA+IGkgKyA1ICYmIHhtbERhdGFbaSArIDFdID09PSAnLScgJiYgeG1sRGF0YVtpICsgMl0gPT09ICctJykge1xuICAgIC8vY29tbWVudFxuICAgIGZvciAoaSArPSAzOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHhtbERhdGFbaV0gPT09ICctJyAmJiB4bWxEYXRhW2kgKyAxXSA9PT0gJy0nICYmIHhtbERhdGFbaSArIDJdID09PSAnPicpIHtcbiAgICAgICAgaSArPSAyO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSBpZiAoXG4gICAgeG1sRGF0YS5sZW5ndGggPiBpICsgOCAmJlxuICAgIHhtbERhdGFbaSArIDFdID09PSAnRCcgJiZcbiAgICB4bWxEYXRhW2kgKyAyXSA9PT0gJ08nICYmXG4gICAgeG1sRGF0YVtpICsgM10gPT09ICdDJyAmJlxuICAgIHhtbERhdGFbaSArIDRdID09PSAnVCcgJiZcbiAgICB4bWxEYXRhW2kgKyA1XSA9PT0gJ1knICYmXG4gICAgeG1sRGF0YVtpICsgNl0gPT09ICdQJyAmJlxuICAgIHhtbERhdGFbaSArIDddID09PSAnRSdcbiAgKSB7XG4gICAgbGV0IGFuZ2xlQnJhY2tldHNDb3VudCA9IDE7XG4gICAgZm9yIChpICs9IDg7IGkgPCB4bWxEYXRhLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZiAoeG1sRGF0YVtpXSA9PT0gJzwnKSB7XG4gICAgICAgIGFuZ2xlQnJhY2tldHNDb3VudCsrO1xuICAgICAgfSBlbHNlIGlmICh4bWxEYXRhW2ldID09PSAnPicpIHtcbiAgICAgICAgYW5nbGVCcmFja2V0c0NvdW50LS07XG4gICAgICAgIGlmIChhbmdsZUJyYWNrZXRzQ291bnQgPT09IDApIHtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChcbiAgICB4bWxEYXRhLmxlbmd0aCA+IGkgKyA5ICYmXG4gICAgeG1sRGF0YVtpICsgMV0gPT09ICdbJyAmJlxuICAgIHhtbERhdGFbaSArIDJdID09PSAnQycgJiZcbiAgICB4bWxEYXRhW2kgKyAzXSA9PT0gJ0QnICYmXG4gICAgeG1sRGF0YVtpICsgNF0gPT09ICdBJyAmJlxuICAgIHhtbERhdGFbaSArIDVdID09PSAnVCcgJiZcbiAgICB4bWxEYXRhW2kgKyA2XSA9PT0gJ0EnICYmXG4gICAgeG1sRGF0YVtpICsgN10gPT09ICdbJ1xuICApIHtcbiAgICBmb3IgKGkgKz0gODsgaSA8IHhtbERhdGEubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh4bWxEYXRhW2ldID09PSAnXScgJiYgeG1sRGF0YVtpICsgMV0gPT09ICddJyAmJiB4bWxEYXRhW2kgKyAyXSA9PT0gJz4nKSB7XG4gICAgICAgIGkgKz0gMjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGk7XG59XG5cbmNvbnN0IGRvdWJsZVF1b3RlID0gJ1wiJztcbmNvbnN0IHNpbmdsZVF1b3RlID0gXCInXCI7XG5cbi8qKlxuICogS2VlcCByZWFkaW5nIHhtbERhdGEgdW50aWwgJzwnIGlzIGZvdW5kIG91dHNpZGUgdGhlIGF0dHJpYnV0ZSB2YWx1ZS5cbiAqIEBwYXJhbSB7c3RyaW5nfSB4bWxEYXRhXG4gKiBAcGFyYW0ge251bWJlcn0gaVxuICovXG5mdW5jdGlvbiByZWFkQXR0cmlidXRlU3RyKHhtbERhdGEsIGkpIHtcbiAgbGV0IGF0dHJTdHIgPSAnJztcbiAgbGV0IHN0YXJ0Q2hhciA9ICcnO1xuICBsZXQgdGFnQ2xvc2VkID0gZmFsc2U7XG4gIGZvciAoOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh4bWxEYXRhW2ldID09PSBkb3VibGVRdW90ZSB8fCB4bWxEYXRhW2ldID09PSBzaW5nbGVRdW90ZSkge1xuICAgICAgaWYgKHN0YXJ0Q2hhciA9PT0gJycpIHtcbiAgICAgICAgc3RhcnRDaGFyID0geG1sRGF0YVtpXTtcbiAgICAgIH0gZWxzZSBpZiAoc3RhcnRDaGFyICE9PSB4bWxEYXRhW2ldKSB7XG4gICAgICAgIC8vaWYgdmF1ZSBpcyBlbmNsb3NlZCB3aXRoIGRvdWJsZSBxdW90ZSB0aGVuIHNpbmdsZSBxdW90ZXMgYXJlIGFsbG93ZWQgaW5zaWRlIHRoZSB2YWx1ZSBhbmQgdmljZSB2ZXJzYVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RhcnRDaGFyID0gJyc7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh4bWxEYXRhW2ldID09PSAnPicpIHtcbiAgICAgIGlmIChzdGFydENoYXIgPT09ICcnKSB7XG4gICAgICAgIHRhZ0Nsb3NlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBhdHRyU3RyICs9IHhtbERhdGFbaV07XG4gIH1cbiAgaWYgKHN0YXJ0Q2hhciAhPT0gJycpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHZhbHVlOiBhdHRyU3RyLFxuICAgIGluZGV4OiBpLFxuICAgIHRhZ0Nsb3NlZDogdGFnQ2xvc2VkXG4gIH07XG59XG5cbi8qKlxuICogU2VsZWN0IGFsbCB0aGUgYXR0cmlidXRlcyB3aGV0aGVyIHZhbGlkIG9yIGludmFsaWQuXG4gKi9cbmNvbnN0IHZhbGlkQXR0clN0clJlZ3hwID0gbmV3IFJlZ0V4cCgnKFxcXFxzKikoW15cXFxccz1dKykoXFxcXHMqPSk/KFxcXFxzKihbXFwnXCJdKSgoW1xcXFxzXFxcXFNdKSo/KVxcXFw1KT8nLCAnZycpO1xuXG4vL2F0dHIsID1cInNkXCIsIGE9XCJhbWl0J3NcIiwgYT1cInNkXCJiPVwic2FmXCIsIGFiICBjZD1cIlwiXG5cbmZ1bmN0aW9uIHZhbGlkYXRlQXR0cmlidXRlU3RyaW5nKGF0dHJTdHIsIG9wdGlvbnMpIHtcbiAgLy9jb25zb2xlLmxvZyhcInN0YXJ0OlwiK2F0dHJTdHIrXCI6ZW5kXCIpO1xuXG4gIC8vaWYoYXR0clN0ci50cmltKCkubGVuZ3RoID09PSAwKSByZXR1cm4gdHJ1ZTsgLy9lbXB0eSBzdHJpbmdcblxuICBjb25zdCBtYXRjaGVzID0gdXRpbC5nZXRBbGxNYXRjaGVzKGF0dHJTdHIsIHZhbGlkQXR0clN0clJlZ3hwKTtcbiAgY29uc3QgYXR0ck5hbWVzID0ge307XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBtYXRjaGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKG1hdGNoZXNbaV1bMV0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAvL25vc3BhY2UgYmVmb3JlIGF0dHJpYnV0ZSBuYW1lOiBhPVwic2RcImI9XCJzYWZcIlxuICAgICAgcmV0dXJuIGdldEVycm9yT2JqZWN0KCdJbnZhbGlkQXR0cicsIFwiQXR0cmlidXRlICdcIittYXRjaGVzW2ldWzJdK1wiJyBoYXMgbm8gc3BhY2UgaW4gc3RhcnRpbmcuXCIsIGdldFBvc2l0aW9uRnJvbU1hdGNoKG1hdGNoZXNbaV0pKVxuICAgIH0gZWxzZSBpZiAobWF0Y2hlc1tpXVszXSAhPT0gdW5kZWZpbmVkICYmIG1hdGNoZXNbaV1bNF0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIGdldEVycm9yT2JqZWN0KCdJbnZhbGlkQXR0cicsIFwiQXR0cmlidXRlICdcIittYXRjaGVzW2ldWzJdK1wiJyBpcyB3aXRob3V0IHZhbHVlLlwiLCBnZXRQb3NpdGlvbkZyb21NYXRjaChtYXRjaGVzW2ldKSk7XG4gICAgfSBlbHNlIGlmIChtYXRjaGVzW2ldWzNdID09PSB1bmRlZmluZWQgJiYgIW9wdGlvbnMuYWxsb3dCb29sZWFuQXR0cmlidXRlcykge1xuICAgICAgLy9pbmRlcGVuZGVudCBhdHRyaWJ1dGU6IGFiXG4gICAgICByZXR1cm4gZ2V0RXJyb3JPYmplY3QoJ0ludmFsaWRBdHRyJywgXCJib29sZWFuIGF0dHJpYnV0ZSAnXCIrbWF0Y2hlc1tpXVsyXStcIicgaXMgbm90IGFsbG93ZWQuXCIsIGdldFBvc2l0aW9uRnJvbU1hdGNoKG1hdGNoZXNbaV0pKTtcbiAgICB9XG4gICAgLyogZWxzZSBpZihtYXRjaGVzW2ldWzZdID09PSB1bmRlZmluZWQpey8vYXR0cmlidXRlIHdpdGhvdXQgdmFsdWU6IGFiPVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4geyBlcnI6IHsgY29kZTpcIkludmFsaWRBdHRyXCIsbXNnOlwiYXR0cmlidXRlIFwiICsgbWF0Y2hlc1tpXVsyXSArIFwiIGhhcyBubyB2YWx1ZSBhc3NpZ25lZC5cIn19O1xuICAgICAgICAgICAgICAgIH0gKi9cbiAgICBjb25zdCBhdHRyTmFtZSA9IG1hdGNoZXNbaV1bMl07XG4gICAgaWYgKCF2YWxpZGF0ZUF0dHJOYW1lKGF0dHJOYW1lKSkge1xuICAgICAgcmV0dXJuIGdldEVycm9yT2JqZWN0KCdJbnZhbGlkQXR0cicsIFwiQXR0cmlidXRlICdcIithdHRyTmFtZStcIicgaXMgYW4gaW52YWxpZCBuYW1lLlwiLCBnZXRQb3NpdGlvbkZyb21NYXRjaChtYXRjaGVzW2ldKSk7XG4gICAgfVxuICAgIGlmICghYXR0ck5hbWVzLmhhc093blByb3BlcnR5KGF0dHJOYW1lKSkge1xuICAgICAgLy9jaGVjayBmb3IgZHVwbGljYXRlIGF0dHJpYnV0ZS5cbiAgICAgIGF0dHJOYW1lc1thdHRyTmFtZV0gPSAxO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZ2V0RXJyb3JPYmplY3QoJ0ludmFsaWRBdHRyJywgXCJBdHRyaWJ1dGUgJ1wiK2F0dHJOYW1lK1wiJyBpcyByZXBlYXRlZC5cIiwgZ2V0UG9zaXRpb25Gcm9tTWF0Y2gobWF0Y2hlc1tpXSkpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZU51bWJlckFtcGVyc2FuZCh4bWxEYXRhLCBpKSB7XG4gIGxldCByZSA9IC9cXGQvO1xuICBpZiAoeG1sRGF0YVtpXSA9PT0gJ3gnKSB7XG4gICAgaSsrO1xuICAgIHJlID0gL1tcXGRhLWZBLUZdLztcbiAgfVxuICBmb3IgKDsgaSA8IHhtbERhdGEubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoeG1sRGF0YVtpXSA9PT0gJzsnKVxuICAgICAgcmV0dXJuIGk7XG4gICAgaWYgKCF4bWxEYXRhW2ldLm1hdGNoKHJlKSlcbiAgICAgIGJyZWFrO1xuICB9XG4gIHJldHVybiAtMTtcbn1cblxuZnVuY3Rpb24gdmFsaWRhdGVBbXBlcnNhbmQoeG1sRGF0YSwgaSkge1xuICAvLyBodHRwczovL3d3dy53My5vcmcvVFIveG1sLyNkdC1jaGFycmVmXG4gIGkrKztcbiAgaWYgKHhtbERhdGFbaV0gPT09ICc7JylcbiAgICByZXR1cm4gLTE7XG4gIGlmICh4bWxEYXRhW2ldID09PSAnIycpIHtcbiAgICBpKys7XG4gICAgcmV0dXJuIHZhbGlkYXRlTnVtYmVyQW1wZXJzYW5kKHhtbERhdGEsIGkpO1xuICB9XG4gIGxldCBjb3VudCA9IDA7XG4gIGZvciAoOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKywgY291bnQrKykge1xuICAgIGlmICh4bWxEYXRhW2ldLm1hdGNoKC9cXHcvKSAmJiBjb3VudCA8IDIwKVxuICAgICAgY29udGludWU7XG4gICAgaWYgKHhtbERhdGFbaV0gPT09ICc7JylcbiAgICAgIGJyZWFrO1xuICAgIHJldHVybiAtMTtcbiAgfVxuICByZXR1cm4gaTtcbn1cblxuZnVuY3Rpb24gZ2V0RXJyb3JPYmplY3QoY29kZSwgbWVzc2FnZSwgbGluZU51bWJlcikge1xuICByZXR1cm4ge1xuICAgIGVycjoge1xuICAgICAgY29kZTogY29kZSxcbiAgICAgIG1zZzogbWVzc2FnZSxcbiAgICAgIGxpbmU6IGxpbmVOdW1iZXIubGluZSB8fCBsaW5lTnVtYmVyLFxuICAgICAgY29sOiBsaW5lTnVtYmVyLmNvbCxcbiAgICB9LFxuICB9O1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUF0dHJOYW1lKGF0dHJOYW1lKSB7XG4gIHJldHVybiB1dGlsLmlzTmFtZShhdHRyTmFtZSk7XG59XG5cbi8vIGNvbnN0IHN0YXJ0c1dpdGhYTUwgPSAvXnhtbC9pO1xuXG5mdW5jdGlvbiB2YWxpZGF0ZVRhZ05hbWUodGFnbmFtZSkge1xuICByZXR1cm4gdXRpbC5pc05hbWUodGFnbmFtZSkgLyogJiYgIXRhZ25hbWUubWF0Y2goc3RhcnRzV2l0aFhNTCkgKi87XG59XG5cbi8vdGhpcyBmdW5jdGlvbiByZXR1cm5zIHRoZSBsaW5lIG51bWJlciBmb3IgdGhlIGNoYXJhY3RlciBhdCB0aGUgZ2l2ZW4gaW5kZXhcbmZ1bmN0aW9uIGdldExpbmVOdW1iZXJGb3JQb3NpdGlvbih4bWxEYXRhLCBpbmRleCkge1xuICBjb25zdCBsaW5lcyA9IHhtbERhdGEuc3Vic3RyaW5nKDAsIGluZGV4KS5zcGxpdCgvXFxyP1xcbi8pO1xuICByZXR1cm4ge1xuICAgIGxpbmU6IGxpbmVzLmxlbmd0aCxcblxuICAgIC8vIGNvbHVtbiBudW1iZXIgaXMgbGFzdCBsaW5lJ3MgbGVuZ3RoICsgMSwgYmVjYXVzZSBjb2x1bW4gbnVtYmVyaW5nIHN0YXJ0cyBhdCAxOlxuICAgIGNvbDogbGluZXNbbGluZXMubGVuZ3RoIC0gMV0ubGVuZ3RoICsgMVxuICB9O1xufVxuXG4vL3RoaXMgZnVuY3Rpb24gcmV0dXJucyB0aGUgcG9zaXRpb24gb2YgdGhlIGZpcnN0IGNoYXJhY3RlciBvZiBtYXRjaCB3aXRoaW4gYXR0clN0clxuZnVuY3Rpb24gZ2V0UG9zaXRpb25Gcm9tTWF0Y2gobWF0Y2gpIHtcbiAgcmV0dXJuIG1hdGNoLnN0YXJ0SW5kZXggKyBtYXRjaFsxXS5sZW5ndGg7XG59XG4iLCAiXG5jb25zdCB7IERBTkdFUk9VU19QUk9QRVJUWV9OQU1FUywgY3JpdGljYWxQcm9wZXJ0aWVzIH0gPSByZXF1aXJlKFwiLi4vdXRpbFwiKTtcblxuY29uc3QgZGVmYXVsdE9uRGFuZ2Vyb3VzUHJvcGVydHkgPSAobmFtZSkgPT4ge1xuICBpZiAoREFOR0VST1VTX1BST1BFUlRZX05BTUVTLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgcmV0dXJuIFwiX19cIiArIG5hbWU7XG4gIH1cbiAgcmV0dXJuIG5hbWU7XG59O1xuY29uc3QgZGVmYXVsdE9wdGlvbnMgPSB7XG4gIHByZXNlcnZlT3JkZXI6IGZhbHNlLFxuICBhdHRyaWJ1dGVOYW1lUHJlZml4OiAnQF8nLFxuICBhdHRyaWJ1dGVzR3JvdXBOYW1lOiBmYWxzZSxcbiAgdGV4dE5vZGVOYW1lOiAnI3RleHQnLFxuICBpZ25vcmVBdHRyaWJ1dGVzOiB0cnVlLFxuICByZW1vdmVOU1ByZWZpeDogZmFsc2UsIC8vIHJlbW92ZSBOUyBmcm9tIHRhZyBuYW1lIG9yIGF0dHJpYnV0ZSBuYW1lIGlmIHRydWVcbiAgYWxsb3dCb29sZWFuQXR0cmlidXRlczogZmFsc2UsIC8vYSB0YWcgY2FuIGhhdmUgYXR0cmlidXRlcyB3aXRob3V0IGFueSB2YWx1ZVxuICAvL2lnbm9yZVJvb3RFbGVtZW50IDogZmFsc2UsXG4gIHBhcnNlVGFnVmFsdWU6IHRydWUsXG4gIHBhcnNlQXR0cmlidXRlVmFsdWU6IGZhbHNlLFxuICB0cmltVmFsdWVzOiB0cnVlLCAvL1RyaW0gc3RyaW5nIHZhbHVlcyBvZiB0YWcgYW5kIGF0dHJpYnV0ZXNcbiAgY2RhdGFQcm9wTmFtZTogZmFsc2UsXG4gIG51bWJlclBhcnNlT3B0aW9uczoge1xuICAgIGhleDogdHJ1ZSxcbiAgICBsZWFkaW5nWmVyb3M6IHRydWUsXG4gICAgZU5vdGF0aW9uOiB0cnVlXG4gIH0sXG4gIHRhZ1ZhbHVlUHJvY2Vzc29yOiBmdW5jdGlvbiAodGFnTmFtZSwgdmFsKSB7XG4gICAgcmV0dXJuIHZhbDtcbiAgfSxcbiAgYXR0cmlidXRlVmFsdWVQcm9jZXNzb3I6IGZ1bmN0aW9uIChhdHRyTmFtZSwgdmFsKSB7XG4gICAgcmV0dXJuIHZhbDtcbiAgfSxcbiAgc3RvcE5vZGVzOiBbXSwgLy9uZXN0ZWQgdGFncyB3aWxsIG5vdCBiZSBwYXJzZWQgZXZlbiBmb3IgZXJyb3JzXG4gIGFsd2F5c0NyZWF0ZVRleHROb2RlOiBmYWxzZSxcbiAgaXNBcnJheTogKCkgPT4gZmFsc2UsXG4gIGNvbW1lbnRQcm9wTmFtZTogZmFsc2UsXG4gIHVucGFpcmVkVGFnczogW10sXG4gIHByb2Nlc3NFbnRpdGllczogdHJ1ZSxcbiAgaHRtbEVudGl0aWVzOiBmYWxzZSxcbiAgaWdub3JlRGVjbGFyYXRpb246IGZhbHNlLFxuICBpZ25vcmVQaVRhZ3M6IGZhbHNlLFxuICB0cmFuc2Zvcm1UYWdOYW1lOiBmYWxzZSxcbiAgdHJhbnNmb3JtQXR0cmlidXRlTmFtZTogZmFsc2UsXG4gIHVwZGF0ZVRhZzogZnVuY3Rpb24gKHRhZ05hbWUsIGpQYXRoLCBhdHRycykge1xuICAgIHJldHVybiB0YWdOYW1lXG4gIH0sXG4gIC8vIHNraXBFbXB0eUxpc3RJdGVtOiBmYWxzZVxuICBjYXB0dXJlTWV0YURhdGE6IGZhbHNlLFxuICBtYXhOZXN0ZWRUYWdzOiAxMDAsXG4gIHN0cmljdFJlc2VydmVkTmFtZXM6IHRydWUsXG4gIG9uRGFuZ2Vyb3VzUHJvcGVydHk6IGRlZmF1bHRPbkRhbmdlcm91c1Byb3BlcnR5XG59O1xuLyoqXG4gKiBWYWxpZGF0ZXMgdGhhdCBhIHByb3BlcnR5IG5hbWUgaXMgc2FmZSB0byB1c2VcbiAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wZXJ0eU5hbWUgLSBUaGUgcHJvcGVydHkgbmFtZSB0byB2YWxpZGF0ZVxuICogQHBhcmFtIHtzdHJpbmd9IG9wdGlvbk5hbWUgLSBUaGUgb3B0aW9uIGZpZWxkIG5hbWUgKGZvciBlcnJvciBtZXNzYWdlKVxuICogQHRocm93cyB7RXJyb3J9IElmIHByb3BlcnR5IG5hbWUgaXMgZGFuZ2Vyb3VzXG4gKi9cbmZ1bmN0aW9uIHZhbGlkYXRlUHJvcGVydHlOYW1lKHByb3BlcnR5TmFtZSwgb3B0aW9uTmFtZSkge1xuICBpZiAodHlwZW9mIHByb3BlcnR5TmFtZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm47IC8vIE9ubHkgdmFsaWRhdGUgc3RyaW5nIHByb3BlcnR5IG5hbWVzXG4gIH1cblxuICBjb25zdCBub3JtYWxpemVkID0gcHJvcGVydHlOYW1lLnRvTG93ZXJDYXNlKCk7XG4gIGlmIChEQU5HRVJPVVNfUFJPUEVSVFlfTkFNRVMuc29tZShkYW5nZXJvdXMgPT4gbm9ybWFsaXplZCA9PT0gZGFuZ2Vyb3VzLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgYFtTRUNVUklUWV0gSW52YWxpZCAke29wdGlvbk5hbWV9OiBcIiR7cHJvcGVydHlOYW1lfVwiIGlzIGEgcmVzZXJ2ZWQgSmF2YVNjcmlwdCBrZXl3b3JkIHRoYXQgY291bGQgY2F1c2UgcHJvdG90eXBlIHBvbGx1dGlvbmBcbiAgICApO1xuICB9XG5cbiAgaWYgKGNyaXRpY2FsUHJvcGVydGllcy5zb21lKGRhbmdlcm91cyA9PiBub3JtYWxpemVkID09PSBkYW5nZXJvdXMudG9Mb3dlckNhc2UoKSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICBgW1NFQ1VSSVRZXSBJbnZhbGlkICR7b3B0aW9uTmFtZX06IFwiJHtwcm9wZXJ0eU5hbWV9XCIgaXMgYSByZXNlcnZlZCBKYXZhU2NyaXB0IGtleXdvcmQgdGhhdCBjb3VsZCBjYXVzZSBwcm90b3R5cGUgcG9sbHV0aW9uYFxuICAgICk7XG4gIH1cbn1cblxuLyoqXG4gKiBOb3JtYWxpemVzIHByb2Nlc3NFbnRpdGllcyBvcHRpb24gZm9yIGJhY2t3YXJkIGNvbXBhdGliaWxpdHlcbiAqIEBwYXJhbSB7Ym9vbGVhbnxvYmplY3R9IHZhbHVlIFxuICogQHJldHVybnMge29iamVjdH0gQWx3YXlzIHJldHVybnMgbm9ybWFsaXplZCBvYmplY3RcbiAqL1xuZnVuY3Rpb24gbm9ybWFsaXplUHJvY2Vzc0VudGl0aWVzKHZhbHVlKSB7XG4gIC8vIEJvb2xlYW4gYmFja3dhcmQgY29tcGF0aWJpbGl0eVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnYm9vbGVhbicpIHtcbiAgICByZXR1cm4ge1xuICAgICAgZW5hYmxlZDogdmFsdWUsIC8vIHRydWUgb3IgZmFsc2VcbiAgICAgIG1heEVudGl0eVNpemU6IDEwMDAwLFxuICAgICAgbWF4RXhwYW5zaW9uRGVwdGg6IDEwLFxuICAgICAgbWF4VG90YWxFeHBhbnNpb25zOiAxMDAwLFxuICAgICAgbWF4RXhwYW5kZWRMZW5ndGg6IDEwMDAwMCxcbiAgICAgIGFsbG93ZWRUYWdzOiBudWxsLFxuICAgICAgdGFnRmlsdGVyOiBudWxsXG4gICAgfTtcbiAgfVxuXG4gIC8vIE9iamVjdCBjb25maWcgLSBtZXJnZSB3aXRoIGRlZmF1bHRzXG4gIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGVuYWJsZWQ6IHZhbHVlLmVuYWJsZWQgIT09IGZhbHNlLFxuICAgICAgbWF4RW50aXR5U2l6ZTogTWF0aC5tYXgoMSwgdmFsdWUubWF4RW50aXR5U2l6ZSA/PyAxMDAwMCksXG4gICAgICBtYXhFeHBhbnNpb25EZXB0aDogTWF0aC5tYXgoMSwgdmFsdWUubWF4RXhwYW5zaW9uRGVwdGggPz8gMTAwMDApLFxuICAgICAgbWF4VG90YWxFeHBhbnNpb25zOiBNYXRoLm1heCgxLCB2YWx1ZS5tYXhUb3RhbEV4cGFuc2lvbnMgPz8gSW5maW5pdHkpLFxuICAgICAgbWF4RXhwYW5kZWRMZW5ndGg6IE1hdGgubWF4KDEsIHZhbHVlLm1heEV4cGFuZGVkTGVuZ3RoID8/IDEwMDAwMCksXG4gICAgICBtYXhFbnRpdHlDb3VudDogTWF0aC5tYXgoMSwgdmFsdWUubWF4RW50aXR5Q291bnQgPz8gMTAwMCksXG4gICAgICBhbGxvd2VkVGFnczogdmFsdWUuYWxsb3dlZFRhZ3MgPz8gbnVsbCxcbiAgICAgIHRhZ0ZpbHRlcjogdmFsdWUudGFnRmlsdGVyID8/IG51bGxcbiAgICB9O1xuICB9XG5cbiAgLy8gRGVmYXVsdCB0byBlbmFibGVkIHdpdGggbGltaXRzXG4gIHJldHVybiBub3JtYWxpemVQcm9jZXNzRW50aXRpZXModHJ1ZSk7XG59XG5cbmNvbnN0IGJ1aWxkT3B0aW9ucyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIGNvbnN0IGJ1aWx0ID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuXG5cbiAgLy8gVmFsaWRhdGUgcHJvcGVydHkgbmFtZXMgdG8gcHJldmVudCBwcm90b3R5cGUgcG9sbHV0aW9uXG4gIGNvbnN0IHByb3BlcnR5TmFtZU9wdGlvbnMgPSBbXG4gICAgeyB2YWx1ZTogYnVpbHQuYXR0cmlidXRlTmFtZVByZWZpeCwgbmFtZTogJ2F0dHJpYnV0ZU5hbWVQcmVmaXgnIH0sXG4gICAgeyB2YWx1ZTogYnVpbHQuYXR0cmlidXRlc0dyb3VwTmFtZSwgbmFtZTogJ2F0dHJpYnV0ZXNHcm91cE5hbWUnIH0sXG4gICAgeyB2YWx1ZTogYnVpbHQudGV4dE5vZGVOYW1lLCBuYW1lOiAndGV4dE5vZGVOYW1lJyB9LFxuICAgIHsgdmFsdWU6IGJ1aWx0LmNkYXRhUHJvcE5hbWUsIG5hbWU6ICdjZGF0YVByb3BOYW1lJyB9LFxuICAgIHsgdmFsdWU6IGJ1aWx0LmNvbW1lbnRQcm9wTmFtZSwgbmFtZTogJ2NvbW1lbnRQcm9wTmFtZScgfVxuICBdO1xuXG4gIGZvciAoY29uc3QgeyB2YWx1ZSwgbmFtZSB9IG9mIHByb3BlcnR5TmFtZU9wdGlvbnMpIHtcbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIHZhbGlkYXRlUHJvcGVydHlOYW1lKHZhbHVlLCBuYW1lKTtcbiAgICB9XG4gIH1cblxuICBpZiAoYnVpbHQub25EYW5nZXJvdXNQcm9wZXJ0eSA9PT0gbnVsbCkge1xuICAgIGJ1aWx0Lm9uRGFuZ2Vyb3VzUHJvcGVydHkgPSBkZWZhdWx0T25EYW5nZXJvdXNQcm9wZXJ0eTtcbiAgfVxuXG4gIC8vIEFsd2F5cyBub3JtYWxpemUgcHJvY2Vzc0VudGl0aWVzIGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGFuZCB2YWxpZGF0aW9uXG4gIGJ1aWx0LnByb2Nlc3NFbnRpdGllcyA9IG5vcm1hbGl6ZVByb2Nlc3NFbnRpdGllcyhidWlsdC5wcm9jZXNzRW50aXRpZXMpO1xuICAvL2NvbnNvbGUuZGVidWcoYnVpbHQucHJvY2Vzc0VudGl0aWVzKVxuICByZXR1cm4gYnVpbHQ7XG59O1xuXG5leHBvcnRzLmJ1aWxkT3B0aW9ucyA9IGJ1aWxkT3B0aW9ucztcbmV4cG9ydHMuZGVmYXVsdE9wdGlvbnMgPSBkZWZhdWx0T3B0aW9uczsiLCAiJ3VzZSBzdHJpY3QnO1xuXG5jbGFzcyBYbWxOb2Rle1xuICBjb25zdHJ1Y3Rvcih0YWduYW1lKSB7XG4gICAgdGhpcy50YWduYW1lID0gdGFnbmFtZTtcbiAgICB0aGlzLmNoaWxkID0gW107IC8vbmVzdGVkIHRhZ3MsIHRleHQsIGNkYXRhLCBjb21tZW50cyBpbiBvcmRlclxuICAgIHRoaXNbXCI6QFwiXSA9IHt9OyAvL2F0dHJpYnV0ZXMgbWFwXG4gIH1cbiAgYWRkKGtleSx2YWwpe1xuICAgIC8vIHRoaXMuY2hpbGQucHVzaCgge25hbWUgOiBrZXksIHZhbDogdmFsLCBpc0NkYXRhOiBpc0NkYXRhIH0pO1xuICAgIGlmKGtleSA9PT0gXCJfX3Byb3RvX19cIikga2V5ID0gXCIjX19wcm90b19fXCI7XG4gICAgdGhpcy5jaGlsZC5wdXNoKCB7W2tleV06IHZhbCB9KTtcbiAgfVxuICBhZGRDaGlsZChub2RlKSB7XG4gICAgaWYobm9kZS50YWduYW1lID09PSBcIl9fcHJvdG9fX1wiKSBub2RlLnRhZ25hbWUgPSBcIiNfX3Byb3RvX19cIjtcbiAgICBpZihub2RlW1wiOkBcIl0gJiYgT2JqZWN0LmtleXMobm9kZVtcIjpAXCJdKS5sZW5ndGggPiAwKXtcbiAgICAgIHRoaXMuY2hpbGQucHVzaCggeyBbbm9kZS50YWduYW1lXTogbm9kZS5jaGlsZCwgW1wiOkBcIl06IG5vZGVbXCI6QFwiXSB9KTtcbiAgICB9ZWxzZXtcbiAgICAgIHRoaXMuY2hpbGQucHVzaCggeyBbbm9kZS50YWduYW1lXTogbm9kZS5jaGlsZCB9KTtcbiAgICB9XG4gIH07XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gWG1sTm9kZTsiLCAiY29uc3QgdXRpbCA9IHJlcXVpcmUoJy4uL3V0aWwnKTtcblxuY2xhc3MgRG9jVHlwZVJlYWRlciB7XG4gICAgY29uc3RydWN0b3Iob3B0aW9ucykge1xuICAgICAgICB0aGlzLnN1cHByZXNzVmFsaWRhdGlvbkVyciA9ICFvcHRpb25zO1xuICAgICAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIH1cblxuICAgIHJlYWREb2NUeXBlKHhtbERhdGEsIGkpIHtcbiAgICAgICAgY29uc3QgZW50aXRpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgICAgICBsZXQgZW50aXR5Q291bnQgPSAwO1xuXG4gICAgICAgIGlmICh4bWxEYXRhW2kgKyAzXSA9PT0gJ08nICYmXG4gICAgICAgICAgICB4bWxEYXRhW2kgKyA0XSA9PT0gJ0MnICYmXG4gICAgICAgICAgICB4bWxEYXRhW2kgKyA1XSA9PT0gJ1QnICYmXG4gICAgICAgICAgICB4bWxEYXRhW2kgKyA2XSA9PT0gJ1knICYmXG4gICAgICAgICAgICB4bWxEYXRhW2kgKyA3XSA9PT0gJ1AnICYmXG4gICAgICAgICAgICB4bWxEYXRhW2kgKyA4XSA9PT0gJ0UnKSB7XG5cbiAgICAgICAgICAgIGkgPSBpICsgOTtcbiAgICAgICAgICAgIGxldCBhbmdsZUJyYWNrZXRzQ291bnQgPSAxO1xuICAgICAgICAgICAgbGV0IGhhc0JvZHkgPSBmYWxzZSwgY29tbWVudCA9IGZhbHNlO1xuICAgICAgICAgICAgbGV0IGV4cCA9IFwiXCI7XG5cbiAgICAgICAgICAgIGZvciAoOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIGlmICh4bWxEYXRhW2ldID09PSAnPCcgJiYgIWNvbW1lbnQpIHsgLy9EZXRlcm1pbmUgdGhlIHRhZyB0eXBlXG4gICAgICAgICAgICAgICAgICAgIGlmIChoYXNCb2R5ICYmIGhhc1NlcSh4bWxEYXRhLCBcIiFFTlRJVFlcIiwgaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGkgKz0gNztcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbnRpdHlOYW1lLCB2YWw7XG4gICAgICAgICAgICAgICAgICAgICAgICBbZW50aXR5TmFtZSwgdmFsLCBpXSA9IHRoaXMucmVhZEVudGl0eUV4cCh4bWxEYXRhLCBpICsgMSwgdGhpcy5zdXBwcmVzc1ZhbGlkYXRpb25FcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHZhbC5pbmRleE9mKFwiJlwiKSA9PT0gLTEpIHsgLy9QYXJhbWV0ZXIgZW50aXRpZXMgYXJlIG5vdCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLmVuYWJsZWQgIT09IGZhbHNlICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMub3B0aW9ucy5tYXhFbnRpdHlDb3VudCAhPSBudWxsICYmXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvdW50ID49IHRoaXMub3B0aW9ucy5tYXhFbnRpdHlDb3VudCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgRW50aXR5IGNvdW50ICgke2VudGl0eUNvdW50ICsgMX0pIGV4Y2VlZHMgbWF4aW11bSBhbGxvd2VkICgke3RoaXMub3B0aW9ucy5tYXhFbnRpdHlDb3VudH0pYFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvL2NvbnN0IGVzY2FwZWQgPSBlbnRpdHlOYW1lLnJlcGxhY2UoL1suXFwtKyo6XS9nLCAnXFxcXC4nKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkID0gZW50aXR5TmFtZS5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0aWVzW2VudGl0eU5hbWVdID0ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWd4OiBSZWdFeHAoYCYke2VzY2FwZWR9O2AsIFwiZ1wiKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsOiB2YWxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudGl0eUNvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaGFzQm9keSAmJiBoYXNTZXEoeG1sRGF0YSwgXCIhRUxFTUVOVFwiLCBpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaSArPSA4OyAvL05vdCBzdXBwb3J0ZWRcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHsgaW5kZXggfSA9IHRoaXMucmVhZEVsZW1lbnRFeHAoeG1sRGF0YSwgaSArIDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaSA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGhhc0JvZHkgJiYgaGFzU2VxKHhtbERhdGEsIFwiIUFUVExJU1RcIiwgaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGkgKz0gODsgLy9Ob3Qgc3VwcG9ydGVkXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBjb25zdCB7aW5kZXh9ID0gdGhpcy5yZWFkQXR0bGlzdEV4cCh4bWxEYXRhLGkrMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpID0gaW5kZXg7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaGFzQm9keSAmJiBoYXNTZXEoeG1sRGF0YSwgXCIhTk9UQVRJT05cIiwgaSkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGkgKz0gOTsgLy9Ob3Qgc3VwcG9ydGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB7IGluZGV4IH0gPSB0aGlzLnJlYWROb3RhdGlvbkV4cCh4bWxEYXRhLCBpICsgMSwgdGhpcy5zdXBwcmVzc1ZhbGlkYXRpb25FcnIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaSA9IGluZGV4O1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGhhc1NlcSh4bWxEYXRhLCBcIiEtLVwiLCBpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29tbWVudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgRE9DVFlQRWApO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgYW5nbGVCcmFja2V0c0NvdW50Kys7XG4gICAgICAgICAgICAgICAgICAgIGV4cCA9IFwiXCI7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh4bWxEYXRhW2ldID09PSAnPicpIHsgLy9SZWFkIHRhZyBjb250ZW50XG4gICAgICAgICAgICAgICAgICAgIGlmIChjb21tZW50KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoeG1sRGF0YVtpIC0gMV0gPT09IFwiLVwiICYmIHhtbERhdGFbaSAtIDJdID09PSBcIi1cIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbW1lbnQgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBhbmdsZUJyYWNrZXRzQ291bnQtLTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGFuZ2xlQnJhY2tldHNDb3VudC0tO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGlmIChhbmdsZUJyYWNrZXRzQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh4bWxEYXRhW2ldID09PSAnWycpIHtcbiAgICAgICAgICAgICAgICAgICAgaGFzQm9keSA9IHRydWU7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgZXhwICs9IHhtbERhdGFbaV07XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoYW5nbGVCcmFja2V0c0NvdW50ICE9PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmNsb3NlZCBET0NUWVBFYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgVGFnIGluc3RlYWQgb2YgRE9DVFlQRWApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgZW50aXRpZXMsIGkgfTtcbiAgICB9XG5cbiAgICByZWFkRW50aXR5RXhwKHhtbERhdGEsIGkpIHtcbiAgICAgICAgLy9FeHRlcm5hbCBlbnRpdGllcyBhcmUgbm90IHN1cHBvcnRlZFxuICAgICAgICAvLyAgICA8IUVOVElUWSBleHQgU1lTVEVNIFwiaHR0cDovL25vcm1hbC13ZWJzaXRlLmNvbVwiID5cblxuICAgICAgICAvL1BhcmFtZXRlciBlbnRpdGllcyBhcmUgbm90IHN1cHBvcnRlZFxuICAgICAgICAvLyAgICA8IUVOVElUWSBlbnRpdHluYW1lIFwiJmFub3RoZXJFbGVtZW50O1wiPlxuXG4gICAgICAgIC8vSW50ZXJuYWwgZW50aXRpZXMgYXJlIHN1cHBvcnRlZFxuICAgICAgICAvLyAgICA8IUVOVElUWSBlbnRpdHluYW1lIFwicmVwbGFjZW1lbnQgdGV4dFwiPlxuXG4gICAgICAgIC8vIFNraXAgbGVhZGluZyB3aGl0ZXNwYWNlIGFmdGVyIDwhRU5USVRZXG4gICAgICAgIGkgPSBza2lwV2hpdGVzcGFjZSh4bWxEYXRhLCBpKTtcblxuICAgICAgICAvLyBSZWFkIGVudGl0eSBuYW1lXG4gICAgICAgIGxldCBlbnRpdHlOYW1lID0gXCJcIjtcbiAgICAgICAgd2hpbGUgKGkgPCB4bWxEYXRhLmxlbmd0aCAmJiAhL1xccy8udGVzdCh4bWxEYXRhW2ldKSAmJiB4bWxEYXRhW2ldICE9PSAnXCInICYmIHhtbERhdGFbaV0gIT09IFwiJ1wiKSB7XG4gICAgICAgICAgICBlbnRpdHlOYW1lICs9IHhtbERhdGFbaV07XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgdmFsaWRhdGVFbnRpdHlOYW1lKGVudGl0eU5hbWUpO1xuXG4gICAgICAgIC8vIFNraXAgd2hpdGVzcGFjZSBhZnRlciBlbnRpdHkgbmFtZVxuICAgICAgICBpID0gc2tpcFdoaXRlc3BhY2UoeG1sRGF0YSwgaSk7XG5cbiAgICAgICAgLy8gQ2hlY2sgZm9yIHVuc3VwcG9ydGVkIGNvbnN0cnVjdHMgKGV4dGVybmFsIGVudGl0aWVzIG9yIHBhcmFtZXRlciBlbnRpdGllcylcbiAgICAgICAgaWYgKCF0aGlzLnN1cHByZXNzVmFsaWRhdGlvbkVycikge1xuICAgICAgICAgICAgaWYgKHhtbERhdGEuc3Vic3RyaW5nKGksIGkgKyA2KS50b1VwcGVyQ2FzZSgpID09PSBcIlNZU1RFTVwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRXh0ZXJuYWwgZW50aXRpZXMgYXJlIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHhtbERhdGFbaV0gPT09IFwiJVwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiUGFyYW1ldGVyIGVudGl0aWVzIGFyZSBub3Qgc3VwcG9ydGVkXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVhZCBlbnRpdHkgdmFsdWUgKGludGVybmFsIGVudGl0eSlcbiAgICAgICAgbGV0IGVudGl0eVZhbHVlID0gXCJcIjtcbiAgICAgICAgW2ksIGVudGl0eVZhbHVlXSA9IHRoaXMucmVhZElkZW50aWZpZXJWYWwoeG1sRGF0YSwgaSwgXCJlbnRpdHlcIik7XG5cbiAgICAgICAgLy8gVmFsaWRhdGUgZW50aXR5IHNpemVcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5lbmFibGVkICE9PSBmYWxzZSAmJlxuICAgICAgICAgICAgdGhpcy5vcHRpb25zLm1heEVudGl0eVNpemUgIT0gbnVsbCAmJlxuICAgICAgICAgICAgZW50aXR5VmFsdWUubGVuZ3RoID4gdGhpcy5vcHRpb25zLm1heEVudGl0eVNpemUpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRW50aXR5IFwiJHtlbnRpdHlOYW1lfVwiIHNpemUgKCR7ZW50aXR5VmFsdWUubGVuZ3RofSkgZXhjZWVkcyBtYXhpbXVtIGFsbG93ZWQgc2l6ZSAoJHt0aGlzLm9wdGlvbnMubWF4RW50aXR5U2l6ZX0pYFxuICAgICAgICAgICAgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGktLTtcbiAgICAgICAgcmV0dXJuIFtlbnRpdHlOYW1lLCBlbnRpdHlWYWx1ZSwgaV07XG4gICAgfVxuXG4gICAgcmVhZE5vdGF0aW9uRXhwKHhtbERhdGEsIGkpIHtcbiAgICAgICAgLy8gU2tpcCBsZWFkaW5nIHdoaXRlc3BhY2UgYWZ0ZXIgPCFOT1RBVElPTlxuICAgICAgICBpID0gc2tpcFdoaXRlc3BhY2UoeG1sRGF0YSwgaSk7XG5cbiAgICAgICAgLy8gUmVhZCBub3RhdGlvbiBuYW1lXG4gICAgICAgIGxldCBub3RhdGlvbk5hbWUgPSBcIlwiO1xuICAgICAgICB3aGlsZSAoaSA8IHhtbERhdGEubGVuZ3RoICYmICEvXFxzLy50ZXN0KHhtbERhdGFbaV0pKSB7XG4gICAgICAgICAgICBub3RhdGlvbk5hbWUgKz0geG1sRGF0YVtpXTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuICAgICAgICAhdGhpcy5zdXBwcmVzc1ZhbGlkYXRpb25FcnIgJiYgdmFsaWRhdGVFbnRpdHlOYW1lKG5vdGF0aW9uTmFtZSk7XG5cbiAgICAgICAgLy8gU2tpcCB3aGl0ZXNwYWNlIGFmdGVyIG5vdGF0aW9uIG5hbWVcbiAgICAgICAgaSA9IHNraXBXaGl0ZXNwYWNlKHhtbERhdGEsIGkpO1xuXG4gICAgICAgIC8vIENoZWNrIGlkZW50aWZpZXIgdHlwZSAoU1lTVEVNIG9yIFBVQkxJQylcbiAgICAgICAgY29uc3QgaWRlbnRpZmllclR5cGUgPSB4bWxEYXRhLnN1YnN0cmluZyhpLCBpICsgNikudG9VcHBlckNhc2UoKTtcbiAgICAgICAgaWYgKCF0aGlzLnN1cHByZXNzVmFsaWRhdGlvbkVyciAmJiBpZGVudGlmaWVyVHlwZSAhPT0gXCJTWVNURU1cIiAmJiBpZGVudGlmaWVyVHlwZSAhPT0gXCJQVUJMSUNcIikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBTWVNURU0gb3IgUFVCTElDLCBmb3VuZCBcIiR7aWRlbnRpZmllclR5cGV9XCJgKTtcbiAgICAgICAgfVxuICAgICAgICBpICs9IGlkZW50aWZpZXJUeXBlLmxlbmd0aDtcblxuICAgICAgICAvLyBTa2lwIHdoaXRlc3BhY2UgYWZ0ZXIgaWRlbnRpZmllciB0eXBlXG4gICAgICAgIGkgPSBza2lwV2hpdGVzcGFjZSh4bWxEYXRhLCBpKTtcblxuICAgICAgICAvLyBSZWFkIHB1YmxpYyBpZGVudGlmaWVyIChpZiBQVUJMSUMpXG4gICAgICAgIGxldCBwdWJsaWNJZGVudGlmaWVyID0gbnVsbDtcbiAgICAgICAgbGV0IHN5c3RlbUlkZW50aWZpZXIgPSBudWxsO1xuXG4gICAgICAgIGlmIChpZGVudGlmaWVyVHlwZSA9PT0gXCJQVUJMSUNcIikge1xuICAgICAgICAgICAgW2ksIHB1YmxpY0lkZW50aWZpZXJdID0gdGhpcy5yZWFkSWRlbnRpZmllclZhbCh4bWxEYXRhLCBpLCBcInB1YmxpY0lkZW50aWZpZXJcIik7XG5cbiAgICAgICAgICAgIC8vIFNraXAgd2hpdGVzcGFjZSBhZnRlciBwdWJsaWMgaWRlbnRpZmllclxuICAgICAgICAgICAgaSA9IHNraXBXaGl0ZXNwYWNlKHhtbERhdGEsIGkpO1xuXG4gICAgICAgICAgICAvLyBPcHRpb25hbGx5IHJlYWQgc3lzdGVtIGlkZW50aWZpZXJcbiAgICAgICAgICAgIGlmICh4bWxEYXRhW2ldID09PSAnXCInIHx8IHhtbERhdGFbaV0gPT09IFwiJ1wiKSB7XG4gICAgICAgICAgICAgICAgW2ksIHN5c3RlbUlkZW50aWZpZXJdID0gdGhpcy5yZWFkSWRlbnRpZmllclZhbCh4bWxEYXRhLCBpLCBcInN5c3RlbUlkZW50aWZpZXJcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaWRlbnRpZmllclR5cGUgPT09IFwiU1lTVEVNXCIpIHtcbiAgICAgICAgICAgIC8vIFJlYWQgc3lzdGVtIGlkZW50aWZpZXIgKG1hbmRhdG9yeSBmb3IgU1lTVEVNKVxuICAgICAgICAgICAgW2ksIHN5c3RlbUlkZW50aWZpZXJdID0gdGhpcy5yZWFkSWRlbnRpZmllclZhbCh4bWxEYXRhLCBpLCBcInN5c3RlbUlkZW50aWZpZXJcIik7XG5cbiAgICAgICAgICAgIGlmICghdGhpcy5zdXBwcmVzc1ZhbGlkYXRpb25FcnIgJiYgIXN5c3RlbUlkZW50aWZpZXIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIG1hbmRhdG9yeSBzeXN0ZW0gaWRlbnRpZmllciBmb3IgU1lTVEVNIG5vdGF0aW9uXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgbm90YXRpb25OYW1lLCBwdWJsaWNJZGVudGlmaWVyLCBzeXN0ZW1JZGVudGlmaWVyLCBpbmRleDogLS1pIH07XG4gICAgfVxuXG4gICAgcmVhZElkZW50aWZpZXJWYWwoeG1sRGF0YSwgaSwgdHlwZSkge1xuICAgICAgICBsZXQgaWRlbnRpZmllclZhbCA9IFwiXCI7XG4gICAgICAgIGNvbnN0IHN0YXJ0Q2hhciA9IHhtbERhdGFbaV07XG4gICAgICAgIGlmIChzdGFydENoYXIgIT09ICdcIicgJiYgc3RhcnRDaGFyICE9PSBcIidcIikge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBFeHBlY3RlZCBxdW90ZWQgc3RyaW5nLCBmb3VuZCBcIiR7c3RhcnRDaGFyfVwiYCk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuXG4gICAgICAgIHdoaWxlIChpIDwgeG1sRGF0YS5sZW5ndGggJiYgeG1sRGF0YVtpXSAhPT0gc3RhcnRDaGFyKSB7XG4gICAgICAgICAgICBpZGVudGlmaWVyVmFsICs9IHhtbERhdGFbaV07XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoeG1sRGF0YVtpXSAhPT0gc3RhcnRDaGFyKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFVudGVybWluYXRlZCAke3R5cGV9IHZhbHVlYCk7XG4gICAgICAgIH1cbiAgICAgICAgaSsrO1xuICAgICAgICByZXR1cm4gW2ksIGlkZW50aWZpZXJWYWxdO1xuICAgIH1cblxuICAgIHJlYWRFbGVtZW50RXhwKHhtbERhdGEsIGkpIHtcbiAgICAgICAgLy8gPCFFTEVNRU5UIGJyIEVNUFRZPlxuICAgICAgICAvLyA8IUVMRU1FTlQgZGl2IEFOWT5cbiAgICAgICAgLy8gPCFFTEVNRU5UIHRpdGxlICgjUENEQVRBKT5cbiAgICAgICAgLy8gPCFFTEVNRU5UIGJvb2sgKHRpdGxlLCBhdXRob3IrKT5cbiAgICAgICAgLy8gPCFFTEVNRU5UIG5hbWUgKGNvbnRlbnQtbW9kZWwpPlxuXG4gICAgICAgIC8vIFNraXAgbGVhZGluZyB3aGl0ZXNwYWNlIGFmdGVyIDwhRUxFTUVOVFxuICAgICAgICBpID0gc2tpcFdoaXRlc3BhY2UoeG1sRGF0YSwgaSk7XG5cbiAgICAgICAgLy8gUmVhZCBlbGVtZW50IG5hbWVcbiAgICAgICAgbGV0IGVsZW1lbnROYW1lID0gXCJcIjtcbiAgICAgICAgd2hpbGUgKGkgPCB4bWxEYXRhLmxlbmd0aCAmJiAhL1xccy8udGVzdCh4bWxEYXRhW2ldKSkge1xuICAgICAgICAgICAgZWxlbWVudE5hbWUgKz0geG1sRGF0YVtpXTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIGVsZW1lbnQgbmFtZVxuICAgICAgICBpZiAoIXRoaXMuc3VwcHJlc3NWYWxpZGF0aW9uRXJyICYmICF1dGlsLmlzTmFtZShlbGVtZW50TmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBlbGVtZW50IG5hbWU6IFwiJHtlbGVtZW50TmFtZX1cImApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2tpcCB3aGl0ZXNwYWNlIGFmdGVyIGVsZW1lbnQgbmFtZVxuICAgICAgICBpID0gc2tpcFdoaXRlc3BhY2UoeG1sRGF0YSwgaSk7XG4gICAgICAgIGxldCBjb250ZW50TW9kZWwgPSBcIlwiO1xuXG4gICAgICAgIC8vIEV4cGVjdCAnKCcgdG8gc3RhcnQgY29udGVudCBtb2RlbFxuICAgICAgICBpZiAoeG1sRGF0YVtpXSA9PT0gXCJFXCIgJiYgaGFzU2VxKHhtbERhdGEsIFwiTVBUWVwiLCBpKSkge1xuICAgICAgICAgICAgaSArPSA0O1xuICAgICAgICB9IGVsc2UgaWYgKHhtbERhdGFbaV0gPT09IFwiQVwiICYmIGhhc1NlcSh4bWxEYXRhLCBcIk5ZXCIsIGkpKSB7XG4gICAgICAgICAgICBpICs9IDI7XG4gICAgICAgIH0gZWxzZSBpZiAoeG1sRGF0YVtpXSA9PT0gXCIoXCIpIHtcbiAgICAgICAgICAgIGkrKzsgLy8gTW92ZSBwYXN0ICcoJ1xuXG4gICAgICAgICAgICAvLyBSZWFkIGNvbnRlbnQgbW9kZWxcbiAgICAgICAgICAgIHdoaWxlIChpIDwgeG1sRGF0YS5sZW5ndGggJiYgeG1sRGF0YVtpXSAhPT0gXCIpXCIpIHtcbiAgICAgICAgICAgICAgICBjb250ZW50TW9kZWwgKz0geG1sRGF0YVtpXTtcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoeG1sRGF0YVtpXSAhPT0gXCIpXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbnRlcm1pbmF0ZWQgY29udGVudCBtb2RlbFwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICghdGhpcy5zdXBwcmVzc1ZhbGlkYXRpb25FcnIpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBFbGVtZW50IEV4cHJlc3Npb24sIGZvdW5kIFwiJHt4bWxEYXRhW2ldfVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZWxlbWVudE5hbWUsXG4gICAgICAgICAgICBjb250ZW50TW9kZWw6IGNvbnRlbnRNb2RlbC50cmltKCksXG4gICAgICAgICAgICBpbmRleDogaVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJlYWRBdHRsaXN0RXhwKHhtbERhdGEsIGkpIHtcbiAgICAgICAgLy8gU2tpcCBsZWFkaW5nIHdoaXRlc3BhY2UgYWZ0ZXIgPCFBVFRMSVNUXG4gICAgICAgIGkgPSBza2lwV2hpdGVzcGFjZSh4bWxEYXRhLCBpKTtcblxuICAgICAgICAvLyBSZWFkIGVsZW1lbnQgbmFtZVxuICAgICAgICBsZXQgZWxlbWVudE5hbWUgPSBcIlwiO1xuICAgICAgICB3aGlsZSAoaSA8IHhtbERhdGEubGVuZ3RoICYmICEvXFxzLy50ZXN0KHhtbERhdGFbaV0pKSB7XG4gICAgICAgICAgICBlbGVtZW50TmFtZSArPSB4bWxEYXRhW2ldO1xuICAgICAgICAgICAgaSsrO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gVmFsaWRhdGUgZWxlbWVudCBuYW1lXG4gICAgICAgIHZhbGlkYXRlRW50aXR5TmFtZShlbGVtZW50TmFtZSk7XG5cbiAgICAgICAgLy8gU2tpcCB3aGl0ZXNwYWNlIGFmdGVyIGVsZW1lbnQgbmFtZVxuICAgICAgICBpID0gc2tpcFdoaXRlc3BhY2UoeG1sRGF0YSwgaSk7XG5cbiAgICAgICAgLy8gUmVhZCBhdHRyaWJ1dGUgbmFtZVxuICAgICAgICBsZXQgYXR0cmlidXRlTmFtZSA9IFwiXCI7XG4gICAgICAgIHdoaWxlIChpIDwgeG1sRGF0YS5sZW5ndGggJiYgIS9cXHMvLnRlc3QoeG1sRGF0YVtpXSkpIHtcbiAgICAgICAgICAgIGF0dHJpYnV0ZU5hbWUgKz0geG1sRGF0YVtpXTtcbiAgICAgICAgICAgIGkrKztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFZhbGlkYXRlIGF0dHJpYnV0ZSBuYW1lXG4gICAgICAgIGlmICghdmFsaWRhdGVFbnRpdHlOYW1lKGF0dHJpYnV0ZU5hbWUpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgYXR0cmlidXRlIG5hbWU6IFwiJHthdHRyaWJ1dGVOYW1lfVwiYCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBTa2lwIHdoaXRlc3BhY2UgYWZ0ZXIgYXR0cmlidXRlIG5hbWVcbiAgICAgICAgaSA9IHNraXBXaGl0ZXNwYWNlKHhtbERhdGEsIGkpO1xuXG4gICAgICAgIC8vIFJlYWQgYXR0cmlidXRlIHR5cGVcbiAgICAgICAgbGV0IGF0dHJpYnV0ZVR5cGUgPSBcIlwiO1xuICAgICAgICBpZiAoeG1sRGF0YS5zdWJzdHJpbmcoaSwgaSArIDgpLnRvVXBwZXJDYXNlKCkgPT09IFwiTk9UQVRJT05cIikge1xuICAgICAgICAgICAgYXR0cmlidXRlVHlwZSA9IFwiTk9UQVRJT05cIjtcbiAgICAgICAgICAgIGkgKz0gODsgLy8gTW92ZSBwYXN0IFwiTk9UQVRJT05cIlxuXG4gICAgICAgICAgICAvLyBTa2lwIHdoaXRlc3BhY2UgYWZ0ZXIgXCJOT1RBVElPTlwiXG4gICAgICAgICAgICBpID0gc2tpcFdoaXRlc3BhY2UoeG1sRGF0YSwgaSk7XG5cbiAgICAgICAgICAgIC8vIEV4cGVjdCAnKCcgdG8gc3RhcnQgdGhlIGxpc3Qgb2Ygbm90YXRpb25zXG4gICAgICAgICAgICBpZiAoeG1sRGF0YVtpXSAhPT0gXCIoXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEV4cGVjdGVkICcoJywgZm91bmQgXCIke3htbERhdGFbaV19XCJgKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGkrKzsgLy8gTW92ZSBwYXN0ICcoJ1xuXG4gICAgICAgICAgICAvLyBSZWFkIHRoZSBsaXN0IG9mIGFsbG93ZWQgbm90YXRpb25zXG4gICAgICAgICAgICBsZXQgYWxsb3dlZE5vdGF0aW9ucyA9IFtdO1xuICAgICAgICAgICAgd2hpbGUgKGkgPCB4bWxEYXRhLmxlbmd0aCAmJiB4bWxEYXRhW2ldICE9PSBcIilcIikge1xuICAgICAgICAgICAgICAgIGxldCBub3RhdGlvbiA9IFwiXCI7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCB4bWxEYXRhLmxlbmd0aCAmJiB4bWxEYXRhW2ldICE9PSBcInxcIiAmJiB4bWxEYXRhW2ldICE9PSBcIilcIikge1xuICAgICAgICAgICAgICAgICAgICBub3RhdGlvbiArPSB4bWxEYXRhW2ldO1xuICAgICAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgbm90YXRpb24gbmFtZVxuICAgICAgICAgICAgICAgIG5vdGF0aW9uID0gbm90YXRpb24udHJpbSgpO1xuICAgICAgICAgICAgICAgIGlmICghdmFsaWRhdGVFbnRpdHlOYW1lKG5vdGF0aW9uKSkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgbm90YXRpb24gbmFtZTogXCIke25vdGF0aW9ufVwiYCk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYWxsb3dlZE5vdGF0aW9ucy5wdXNoKG5vdGF0aW9uKTtcblxuICAgICAgICAgICAgICAgIC8vIFNraXAgJ3wnIHNlcGFyYXRvciBvciBleGl0IGxvb3BcbiAgICAgICAgICAgICAgICBpZiAoeG1sRGF0YVtpXSA9PT0gXCJ8XCIpIHtcbiAgICAgICAgICAgICAgICAgICAgaSsrOyAvLyBNb3ZlIHBhc3QgJ3wnXG4gICAgICAgICAgICAgICAgICAgIGkgPSBza2lwV2hpdGVzcGFjZSh4bWxEYXRhLCBpKTsgLy8gU2tpcCBvcHRpb25hbCB3aGl0ZXNwYWNlIGFmdGVyICd8J1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHhtbERhdGFbaV0gIT09IFwiKVwiKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVW50ZXJtaW5hdGVkIGxpc3Qgb2Ygbm90YXRpb25zXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSsrOyAvLyBNb3ZlIHBhc3QgJyknXG5cbiAgICAgICAgICAgIC8vIFN0b3JlIHRoZSBhbGxvd2VkIG5vdGF0aW9ucyBhcyBwYXJ0IG9mIHRoZSBhdHRyaWJ1dGUgdHlwZVxuICAgICAgICAgICAgYXR0cmlidXRlVHlwZSArPSBcIiAoXCIgKyBhbGxvd2VkTm90YXRpb25zLmpvaW4oXCJ8XCIpICsgXCIpXCI7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBIYW5kbGUgc2ltcGxlIHR5cGVzIChlLmcuLCBDREFUQSwgSUQsIElEUkVGLCBldGMuKVxuICAgICAgICAgICAgd2hpbGUgKGkgPCB4bWxEYXRhLmxlbmd0aCAmJiAhL1xccy8udGVzdCh4bWxEYXRhW2ldKSkge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZVR5cGUgKz0geG1sRGF0YVtpXTtcbiAgICAgICAgICAgICAgICBpKys7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIFZhbGlkYXRlIHNpbXBsZSBhdHRyaWJ1dGUgdHlwZVxuICAgICAgICAgICAgY29uc3QgdmFsaWRUeXBlcyA9IFtcIkNEQVRBXCIsIFwiSURcIiwgXCJJRFJFRlwiLCBcIklEUkVGU1wiLCBcIkVOVElUWVwiLCBcIkVOVElUSUVTXCIsIFwiTk1UT0tFTlwiLCBcIk5NVE9LRU5TXCJdO1xuICAgICAgICAgICAgaWYgKCF0aGlzLnN1cHByZXNzVmFsaWRhdGlvbkVyciAmJiAhdmFsaWRUeXBlcy5pbmNsdWRlcyhhdHRyaWJ1dGVUeXBlLnRvVXBwZXJDYXNlKCkpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGF0dHJpYnV0ZSB0eXBlOiBcIiR7YXR0cmlidXRlVHlwZX1cImApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gU2tpcCB3aGl0ZXNwYWNlIGFmdGVyIGF0dHJpYnV0ZSB0eXBlXG4gICAgICAgIGkgPSBza2lwV2hpdGVzcGFjZSh4bWxEYXRhLCBpKTtcblxuICAgICAgICAvLyBSZWFkIGRlZmF1bHQgdmFsdWVcbiAgICAgICAgbGV0IGRlZmF1bHRWYWx1ZSA9IFwiXCI7XG4gICAgICAgIGlmICh4bWxEYXRhLnN1YnN0cmluZyhpLCBpICsgOCkudG9VcHBlckNhc2UoKSA9PT0gXCIjUkVRVUlSRURcIikge1xuICAgICAgICAgICAgZGVmYXVsdFZhbHVlID0gXCIjUkVRVUlSRURcIjtcbiAgICAgICAgICAgIGkgKz0gODtcbiAgICAgICAgfSBlbHNlIGlmICh4bWxEYXRhLnN1YnN0cmluZyhpLCBpICsgNykudG9VcHBlckNhc2UoKSA9PT0gXCIjSU1QTElFRFwiKSB7XG4gICAgICAgICAgICBkZWZhdWx0VmFsdWUgPSBcIiNJTVBMSUVEXCI7XG4gICAgICAgICAgICBpICs9IDc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBbaSwgZGVmYXVsdFZhbHVlXSA9IHRoaXMucmVhZElkZW50aWZpZXJWYWwoeG1sRGF0YSwgaSwgXCJBVFRMSVNUXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGVsZW1lbnROYW1lLFxuICAgICAgICAgICAgYXR0cmlidXRlTmFtZSxcbiAgICAgICAgICAgIGF0dHJpYnV0ZVR5cGUsXG4gICAgICAgICAgICBkZWZhdWx0VmFsdWUsXG4gICAgICAgICAgICBpbmRleDogaVxuICAgICAgICB9O1xuICAgIH1cbn1cblxuLy8gSGVscGVyIGZ1bmN0aW9uc1xuY29uc3Qgc2tpcFdoaXRlc3BhY2UgPSAoZGF0YSwgaW5kZXgpID0+IHtcbiAgICB3aGlsZSAoaW5kZXggPCBkYXRhLmxlbmd0aCAmJiAvXFxzLy50ZXN0KGRhdGFbaW5kZXhdKSkge1xuICAgICAgICBpbmRleCsrO1xuICAgIH1cbiAgICByZXR1cm4gaW5kZXg7XG59O1xuXG5mdW5jdGlvbiBoYXNTZXEoZGF0YSwgc2VxLCBpKSB7XG4gICAgZm9yIChsZXQgaiA9IDA7IGogPCBzZXEubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgaWYgKHNlcVtqXSAhPT0gZGF0YVtpICsgaiArIDFdKSByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiB2YWxpZGF0ZUVudGl0eU5hbWUobmFtZSkge1xuICAgIGlmICh1dGlsLmlzTmFtZShuYW1lKSlcbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgZWxzZVxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgZW50aXR5IG5hbWUgJHtuYW1lfWApO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IERvY1R5cGVSZWFkZXI7IiwgImNvbnN0IGhleFJlZ2V4ID0gL15bLStdPzB4W2EtZkEtRjAtOV0rJC87XG5jb25zdCBudW1SZWdleCA9IC9eKFtcXC1cXCtdKT8oMCopKFswLTldKihcXC5bMC05XSopPykkLztcbi8vIGNvbnN0IG9jdFJlZ2V4ID0gL14weFthLXowLTldKy87XG4vLyBjb25zdCBiaW5SZWdleCA9IC8weFthLXowLTldKy87XG5cbiBcbmNvbnN0IGNvbnNpZGVyID0ge1xuICAgIGhleCA6ICB0cnVlLFxuICAgIC8vIG9jdDogZmFsc2UsXG4gICAgbGVhZGluZ1plcm9zOiB0cnVlLFxuICAgIGRlY2ltYWxQb2ludDogXCJcXC5cIixcbiAgICBlTm90YXRpb246IHRydWUsXG4gICAgLy9za2lwTGlrZTogL3JlZ2V4L1xufTtcblxuZnVuY3Rpb24gdG9OdW1iZXIoc3RyLCBvcHRpb25zID0ge30pe1xuICAgIG9wdGlvbnMgPSBPYmplY3QuYXNzaWduKHt9LCBjb25zaWRlciwgb3B0aW9ucyApO1xuICAgIGlmKCFzdHIgfHwgdHlwZW9mIHN0ciAhPT0gXCJzdHJpbmdcIiApIHJldHVybiBzdHI7XG4gICAgXG4gICAgbGV0IHRyaW1tZWRTdHIgID0gc3RyLnRyaW0oKTtcbiAgICBcbiAgICBpZihvcHRpb25zLnNraXBMaWtlICE9PSB1bmRlZmluZWQgJiYgb3B0aW9ucy5za2lwTGlrZS50ZXN0KHRyaW1tZWRTdHIpKSByZXR1cm4gc3RyO1xuICAgIGVsc2UgaWYoc3RyPT09XCIwXCIpIHJldHVybiAwO1xuICAgIGVsc2UgaWYgKG9wdGlvbnMuaGV4ICYmIGhleFJlZ2V4LnRlc3QodHJpbW1lZFN0cikpIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlX2ludCh0cmltbWVkU3RyLCAxNik7XG4gICAgLy8gfWVsc2UgaWYgKG9wdGlvbnMub2N0ICYmIG9jdFJlZ2V4LnRlc3Qoc3RyKSkge1xuICAgIC8vICAgICByZXR1cm4gTnVtYmVyLnBhcnNlSW50KHZhbCwgOCk7XG4gICAgfWVsc2UgaWYgKHRyaW1tZWRTdHIuc2VhcmNoKC9bZUVdLykhPT0gLTEpIHsgLy9lTm90YXRpb25cbiAgICAgICAgY29uc3Qgbm90YXRpb24gPSB0cmltbWVkU3RyLm1hdGNoKC9eKFstXFwrXSk/KDAqKShbMC05XSooXFwuWzAtOV0qKT9bZUVdWy1cXCtdP1swLTldKykkLyk7IFxuICAgICAgICAvLyArMDAuMTIzID0+IFsgLCAnKycsICcwMCcsICcuMTIzJywgLi5cbiAgICAgICAgaWYobm90YXRpb24pe1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2cobm90YXRpb24pXG4gICAgICAgICAgICBpZihvcHRpb25zLmxlYWRpbmdaZXJvcyl7IC8vYWNjZXB0IHdpdGggbGVhZGluZyB6ZXJvc1xuICAgICAgICAgICAgICAgIHRyaW1tZWRTdHIgPSAobm90YXRpb25bMV0gfHwgXCJcIikgKyBub3RhdGlvblszXTtcbiAgICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgICAgIGlmKG5vdGF0aW9uWzJdID09PSBcIjBcIiAmJiBub3RhdGlvblszXVswXT09PSBcIi5cIil7IC8vdmFsaWQgbnVtYmVyXG4gICAgICAgICAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIG9wdGlvbnMuZU5vdGF0aW9uID8gTnVtYmVyKHRyaW1tZWRTdHIpIDogc3RyO1xuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgIH1cbiAgICAvLyB9ZWxzZSBpZiAob3B0aW9ucy5wYXJzZUJpbiAmJiBiaW5SZWdleC50ZXN0KHN0cikpIHtcbiAgICAvLyAgICAgcmV0dXJuIE51bWJlci5wYXJzZUludCh2YWwsIDIpO1xuICAgIH1lbHNle1xuICAgICAgICAvL3NlcGFyYXRlIG5lZ2F0aXZlIHNpZ24sIGxlYWRpbmcgemVyb3MsIGFuZCByZXN0IG51bWJlclxuICAgICAgICBjb25zdCBtYXRjaCA9IG51bVJlZ2V4LmV4ZWModHJpbW1lZFN0cik7XG4gICAgICAgIC8vICswMC4xMjMgPT4gWyAsICcrJywgJzAwJywgJy4xMjMnLCAuLlxuICAgICAgICBpZihtYXRjaCl7XG4gICAgICAgICAgICBjb25zdCBzaWduID0gbWF0Y2hbMV07XG4gICAgICAgICAgICBjb25zdCBsZWFkaW5nWmVyb3MgPSBtYXRjaFsyXTtcbiAgICAgICAgICAgIGxldCBudW1UcmltbWVkQnlaZXJvcyA9IHRyaW1aZXJvcyhtYXRjaFszXSk7IC8vY29tcGxldGUgbnVtIHdpdGhvdXQgbGVhZGluZyB6ZXJvc1xuICAgICAgICAgICAgLy90cmltIGVuZGluZyB6ZXJvcyBmb3IgZmxvYXRpbmcgbnVtYmVyXG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGlmKCFvcHRpb25zLmxlYWRpbmdaZXJvcyAmJiBsZWFkaW5nWmVyb3MubGVuZ3RoID4gMCAmJiBzaWduICYmIHRyaW1tZWRTdHJbMl0gIT09IFwiLlwiKSByZXR1cm4gc3RyOyAvLy0wMTIzXG4gICAgICAgICAgICBlbHNlIGlmKCFvcHRpb25zLmxlYWRpbmdaZXJvcyAmJiBsZWFkaW5nWmVyb3MubGVuZ3RoID4gMCAmJiAhc2lnbiAmJiB0cmltbWVkU3RyWzFdICE9PSBcIi5cIikgcmV0dXJuIHN0cjsgLy8wMTIzXG4gICAgICAgICAgICBlbHNlIGlmKG9wdGlvbnMubGVhZGluZ1plcm9zICYmIGxlYWRpbmdaZXJvcz09PXN0cikgcmV0dXJuIDA7IC8vMDBcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgZWxzZXsvL25vIGxlYWRpbmcgemVyb3Mgb3IgbGVhZGluZyB6ZXJvcyBhcmUgYWxsb3dlZFxuICAgICAgICAgICAgICAgIGNvbnN0IG51bSA9IE51bWJlcih0cmltbWVkU3RyKTtcbiAgICAgICAgICAgICAgICBjb25zdCBudW1TdHIgPSBcIlwiICsgbnVtO1xuXG4gICAgICAgICAgICAgICAgaWYobnVtU3RyLnNlYXJjaCgvW2VFXS8pICE9PSAtMSl7IC8vZ2l2ZW4gbnVtYmVyIGlzIGxvbmcgYW5kIHBhcnNlZCB0byBlTm90YXRpb25cbiAgICAgICAgICAgICAgICAgICAgaWYob3B0aW9ucy5lTm90YXRpb24pIHJldHVybiBudW07XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHN0cjtcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZih0cmltbWVkU3RyLmluZGV4T2YoXCIuXCIpICE9PSAtMSl7IC8vZmxvYXRpbmcgbnVtYmVyXG4gICAgICAgICAgICAgICAgICAgIGlmKG51bVN0ciA9PT0gXCIwXCIgJiYgKG51bVRyaW1tZWRCeVplcm9zID09PSBcIlwiKSApIHJldHVybiBudW07IC8vMC4wXG4gICAgICAgICAgICAgICAgICAgIGVsc2UgaWYobnVtU3RyID09PSBudW1UcmltbWVkQnlaZXJvcykgcmV0dXJuIG51bTsgLy8wLjQ1Ni4gMC43OTAwMFxuICAgICAgICAgICAgICAgICAgICBlbHNlIGlmKCBzaWduICYmIG51bVN0ciA9PT0gXCItXCIrbnVtVHJpbW1lZEJ5WmVyb3MpIHJldHVybiBudW07XG4gICAgICAgICAgICAgICAgICAgIGVsc2UgcmV0dXJuIHN0cjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgaWYobGVhZGluZ1plcm9zKXtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIChudW1UcmltbWVkQnlaZXJvcyA9PT0gbnVtU3RyKSB8fCAoc2lnbitudW1UcmltbWVkQnlaZXJvcyA9PT0gbnVtU3RyKSA/IG51bSA6IHN0clxuICAgICAgICAgICAgICAgIH1lbHNlICB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiAodHJpbW1lZFN0ciA9PT0gbnVtU3RyKSB8fCAodHJpbW1lZFN0ciA9PT0gc2lnbitudW1TdHIpID8gbnVtIDogc3RyXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9ZWxzZXsgLy9ub24tbnVtZXJpYyBzdHJpbmdcbiAgICAgICAgICAgIHJldHVybiBzdHI7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogXG4gKiBAcGFyYW0ge3N0cmluZ30gbnVtU3RyIHdpdGhvdXQgbGVhZGluZyB6ZXJvc1xuICogQHJldHVybnMgXG4gKi9cbmZ1bmN0aW9uIHRyaW1aZXJvcyhudW1TdHIpe1xuICAgIGlmKG51bVN0ciAmJiBudW1TdHIuaW5kZXhPZihcIi5cIikgIT09IC0xKXsvL2Zsb2F0XG4gICAgICAgIG51bVN0ciA9IG51bVN0ci5yZXBsYWNlKC8wKyQvLCBcIlwiKTsgLy9yZW1vdmUgZW5kaW5nIHplcm9zXG4gICAgICAgIGlmKG51bVN0ciA9PT0gXCIuXCIpICBudW1TdHIgPSBcIjBcIjtcbiAgICAgICAgZWxzZSBpZihudW1TdHJbMF0gPT09IFwiLlwiKSAgbnVtU3RyID0gXCIwXCIrbnVtU3RyO1xuICAgICAgICBlbHNlIGlmKG51bVN0cltudW1TdHIubGVuZ3RoLTFdID09PSBcIi5cIikgIG51bVN0ciA9IG51bVN0ci5zdWJzdHIoMCxudW1TdHIubGVuZ3RoLTEpO1xuICAgICAgICByZXR1cm4gbnVtU3RyO1xuICAgIH1cbiAgICByZXR1cm4gbnVtU3RyO1xufVxuXG5mdW5jdGlvbiBwYXJzZV9pbnQobnVtU3RyLCBiYXNlKXtcbiAgICAvL3BvbHlmaWxsXG4gICAgaWYocGFyc2VJbnQpIHJldHVybiBwYXJzZUludChudW1TdHIsIGJhc2UpO1xuICAgIGVsc2UgaWYoTnVtYmVyLnBhcnNlSW50KSByZXR1cm4gTnVtYmVyLnBhcnNlSW50KG51bVN0ciwgYmFzZSk7XG4gICAgZWxzZSBpZih3aW5kb3cgJiYgd2luZG93LnBhcnNlSW50KSByZXR1cm4gd2luZG93LnBhcnNlSW50KG51bVN0ciwgYmFzZSk7XG4gICAgZWxzZSB0aHJvdyBuZXcgRXJyb3IoXCJwYXJzZUludCwgTnVtYmVyLnBhcnNlSW50LCB3aW5kb3cucGFyc2VJbnQgYXJlIG5vdCBzdXBwb3J0ZWRcIilcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0b051bWJlcjsiLCAiZnVuY3Rpb24gZ2V0SWdub3JlQXR0cmlidXRlc0ZuKGlnbm9yZUF0dHJpYnV0ZXMpIHtcbiAgICBpZiAodHlwZW9mIGlnbm9yZUF0dHJpYnV0ZXMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgcmV0dXJuIGlnbm9yZUF0dHJpYnV0ZXNcbiAgICB9XG4gICAgaWYgKEFycmF5LmlzQXJyYXkoaWdub3JlQXR0cmlidXRlcykpIHtcbiAgICAgICAgcmV0dXJuIChhdHRyTmFtZSkgPT4ge1xuICAgICAgICAgICAgZm9yIChjb25zdCBwYXR0ZXJuIG9mIGlnbm9yZUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHBhdHRlcm4gPT09ICdzdHJpbmcnICYmIGF0dHJOYW1lID09PSBwYXR0ZXJuKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwYXR0ZXJuIGluc3RhbmNlb2YgUmVnRXhwICYmIHBhdHRlcm4udGVzdChhdHRyTmFtZSkpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IGZhbHNlXG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0SWdub3JlQXR0cmlidXRlc0ZuIiwgIid1c2Ugc3RyaWN0Jztcbi8vL0B0cy1jaGVja1xuXG5jb25zdCB1dGlsID0gcmVxdWlyZSgnLi4vdXRpbCcpO1xuY29uc3QgeG1sTm9kZSA9IHJlcXVpcmUoJy4veG1sTm9kZScpO1xuY29uc3QgRG9jVHlwZVJlYWRlciA9IHJlcXVpcmUoJy4vRG9jVHlwZVJlYWRlcicpO1xuY29uc3QgdG9OdW1iZXIgPSByZXF1aXJlKFwic3RybnVtXCIpO1xuY29uc3QgZ2V0SWdub3JlQXR0cmlidXRlc0ZuID0gcmVxdWlyZSgnLi4vaWdub3JlQXR0cmlidXRlcycpXG5cbi8vIGNvbnN0IHJlZ3ggPVxuLy8gICAnPCgoIVxcXFxbQ0RBVEFcXFxcWyhbXFxcXHNcXFxcU10qPykoXV0+KSl8KChOQU1FOik/KE5BTUUpKShbXj5dKik+fCgoXFxcXC8pKE5BTUUpXFxcXHMqPikpKFtePF0qKSdcbi8vICAgLnJlcGxhY2UoL05BTUUvZywgdXRpbC5uYW1lUmVnZXhwKTtcblxuLy9jb25zdCB0YWdzUmVneCA9IG5ldyBSZWdFeHAoXCI8KFxcXFwvP1tcXFxcdzpcXFxcLVxcLl9dKykoW14+XSopPihcXFxccypcIitjZGF0YVJlZ3grXCIpKihbXjxdKyk/XCIsXCJnXCIpO1xuLy9jb25zdCB0YWdzUmVneCA9IG5ldyBSZWdFeHAoXCI8KFxcXFwvPykoKFxcXFx3KjopPyhbXFxcXHc6XFxcXC1cXC5fXSspKShbXj5dKik+KFtePF0qKShcIitjZGF0YVJlZ3grXCIoW148XSopKSooW148XSspP1wiLFwiZ1wiKTtcblxuY2xhc3MgT3JkZXJlZE9ialBhcnNlciB7XG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMuY3VycmVudE5vZGUgPSBudWxsO1xuICAgIHRoaXMudGFnc05vZGVTdGFjayA9IFtdO1xuICAgIHRoaXMuZG9jVHlwZUVudGl0aWVzID0ge307XG4gICAgdGhpcy5sYXN0RW50aXRpZXMgPSB7XG4gICAgICBcImFwb3NcIjogeyByZWdleDogLyYoYXBvc3wjMzl8I3gyNyk7L2csIHZhbDogXCInXCIgfSxcbiAgICAgIFwiZ3RcIjogeyByZWdleDogLyYoZ3R8IzYyfCN4M0UpOy9nLCB2YWw6IFwiPlwiIH0sXG4gICAgICBcImx0XCI6IHsgcmVnZXg6IC8mKGx0fCM2MHwjeDNDKTsvZywgdmFsOiBcIjxcIiB9LFxuICAgICAgXCJxdW90XCI6IHsgcmVnZXg6IC8mKHF1b3R8IzM0fCN4MjIpOy9nLCB2YWw6IFwiXFxcIlwiIH0sXG4gICAgfTtcbiAgICB0aGlzLmFtcEVudGl0eSA9IHsgcmVnZXg6IC8mKGFtcHwjMzh8I3gyNik7L2csIHZhbDogXCImXCIgfTtcbiAgICB0aGlzLmh0bWxFbnRpdGllcyA9IHtcbiAgICAgIFwic3BhY2VcIjogeyByZWdleDogLyYobmJzcHwjMTYwKTsvZywgdmFsOiBcIiBcIiB9LFxuICAgICAgLy8gXCJsdFwiIDogeyByZWdleDogLyYobHR8IzYwKTsvZywgdmFsOiBcIjxcIiB9LFxuICAgICAgLy8gXCJndFwiIDogeyByZWdleDogLyYoZ3R8IzYyKTsvZywgdmFsOiBcIj5cIiB9LFxuICAgICAgLy8gXCJhbXBcIiA6IHsgcmVnZXg6IC8mKGFtcHwjMzgpOy9nLCB2YWw6IFwiJlwiIH0sXG4gICAgICAvLyBcInF1b3RcIiA6IHsgcmVnZXg6IC8mKHF1b3R8IzM0KTsvZywgdmFsOiBcIlxcXCJcIiB9LFxuICAgICAgLy8gXCJhcG9zXCIgOiB7IHJlZ2V4OiAvJihhcG9zfCMzOSk7L2csIHZhbDogXCInXCIgfSxcbiAgICAgIFwiY2VudFwiOiB7IHJlZ2V4OiAvJihjZW50fCMxNjIpOy9nLCB2YWw6IFwiXHUwMEEyXCIgfSxcbiAgICAgIFwicG91bmRcIjogeyByZWdleDogLyYocG91bmR8IzE2Myk7L2csIHZhbDogXCJcdTAwQTNcIiB9LFxuICAgICAgXCJ5ZW5cIjogeyByZWdleDogLyYoeWVufCMxNjUpOy9nLCB2YWw6IFwiXHUwMEE1XCIgfSxcbiAgICAgIFwiZXVyb1wiOiB7IHJlZ2V4OiAvJihldXJvfCM4MzY0KTsvZywgdmFsOiBcIlx1MjBBQ1wiIH0sXG4gICAgICBcImNvcHlyaWdodFwiOiB7IHJlZ2V4OiAvJihjb3B5fCMxNjkpOy9nLCB2YWw6IFwiXHUwMEE5XCIgfSxcbiAgICAgIFwicmVnXCI6IHsgcmVnZXg6IC8mKHJlZ3wjMTc0KTsvZywgdmFsOiBcIlx1MDBBRVwiIH0sXG4gICAgICBcImluclwiOiB7IHJlZ2V4OiAvJihpbnJ8IzgzNzcpOy9nLCB2YWw6IFwiXHUyMEI5XCIgfSxcbiAgICAgIFwibnVtX2RlY1wiOiB7IHJlZ2V4OiAvJiMoWzAtOV17MSw3fSk7L2csIHZhbDogKF8sIHN0cikgPT4gZnJvbUNvZGVQb2ludChzdHIsIDEwLCBcIiYjXCIpIH0sXG4gICAgICBcIm51bV9oZXhcIjogeyByZWdleDogLyYjeChbMC05YS1mQS1GXXsxLDZ9KTsvZywgdmFsOiAoXywgc3RyKSA9PiBmcm9tQ29kZVBvaW50KHN0ciwgMTYsIFwiJiN4XCIpIH0sXG4gICAgfTtcbiAgICB0aGlzLmFkZEV4dGVybmFsRW50aXRpZXMgPSBhZGRFeHRlcm5hbEVudGl0aWVzO1xuICAgIHRoaXMucGFyc2VYbWwgPSBwYXJzZVhtbDtcbiAgICB0aGlzLnBhcnNlVGV4dERhdGEgPSBwYXJzZVRleHREYXRhO1xuICAgIHRoaXMucmVzb2x2ZU5hbWVTcGFjZSA9IHJlc29sdmVOYW1lU3BhY2U7XG4gICAgdGhpcy5idWlsZEF0dHJpYnV0ZXNNYXAgPSBidWlsZEF0dHJpYnV0ZXNNYXA7XG4gICAgdGhpcy5pc0l0U3RvcE5vZGUgPSBpc0l0U3RvcE5vZGU7XG4gICAgdGhpcy5yZXBsYWNlRW50aXRpZXNWYWx1ZSA9IHJlcGxhY2VFbnRpdGllc1ZhbHVlO1xuICAgIHRoaXMucmVhZFN0b3BOb2RlRGF0YSA9IHJlYWRTdG9wTm9kZURhdGE7XG4gICAgdGhpcy5zYXZlVGV4dFRvUGFyZW50VGFnID0gc2F2ZVRleHRUb1BhcmVudFRhZztcbiAgICB0aGlzLmFkZENoaWxkID0gYWRkQ2hpbGQ7XG4gICAgdGhpcy5pZ25vcmVBdHRyaWJ1dGVzRm4gPSBnZXRJZ25vcmVBdHRyaWJ1dGVzRm4odGhpcy5vcHRpb25zLmlnbm9yZUF0dHJpYnV0ZXMpXG4gICAgdGhpcy5lbnRpdHlFeHBhbnNpb25Db3VudCA9IDA7XG4gICAgdGhpcy5jdXJyZW50RXhwYW5kZWRMZW5ndGggPSAwO1xuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdG9wTm9kZXMgJiYgdGhpcy5vcHRpb25zLnN0b3BOb2Rlcy5sZW5ndGggPiAwKSB7XG4gICAgICB0aGlzLnN0b3BOb2Rlc0V4YWN0ID0gbmV3IFNldCgpO1xuICAgICAgdGhpcy5zdG9wTm9kZXNXaWxkY2FyZCA9IG5ldyBTZXQoKTtcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5vcHRpb25zLnN0b3BOb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBzdG9wTm9kZUV4cCA9IHRoaXMub3B0aW9ucy5zdG9wTm9kZXNbaV07XG4gICAgICAgIGlmICh0eXBlb2Ygc3RvcE5vZGVFeHAgIT09ICdzdHJpbmcnKSBjb250aW51ZTtcbiAgICAgICAgaWYgKHN0b3BOb2RlRXhwLnN0YXJ0c1dpdGgoXCIqLlwiKSkge1xuICAgICAgICAgIHRoaXMuc3RvcE5vZGVzV2lsZGNhcmQuYWRkKHN0b3BOb2RlRXhwLnN1YnN0cmluZygyKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zdG9wTm9kZXNFeGFjdC5hZGQoc3RvcE5vZGVFeHApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbn1cblxuZnVuY3Rpb24gYWRkRXh0ZXJuYWxFbnRpdGllcyhleHRlcm5hbEVudGl0aWVzKSB7XG4gIGNvbnN0IGVudEtleXMgPSBPYmplY3Qua2V5cyhleHRlcm5hbEVudGl0aWVzKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBlbnRLZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgZW50ID0gZW50S2V5c1tpXTtcbiAgICBjb25zdCBlc2NhcGVkID0gZW50LnJlcGxhY2UoL1suXFwtKyo6XS9nLCAnXFxcXC4nKTtcbiAgICB0aGlzLmxhc3RFbnRpdGllc1tlbnRdID0ge1xuICAgICAgcmVnZXg6IG5ldyBSZWdFeHAoXCImXCIgKyBlc2NhcGVkICsgXCI7XCIsIFwiZ1wiKSxcbiAgICAgIHZhbDogZXh0ZXJuYWxFbnRpdGllc1tlbnRdXG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICogQHBhcmFtIHtzdHJpbmd9IHRhZ05hbWVcbiAqIEBwYXJhbSB7c3RyaW5nfSBqUGF0aFxuICogQHBhcmFtIHtib29sZWFufSBkb250VHJpbVxuICogQHBhcmFtIHtib29sZWFufSBoYXNBdHRyaWJ1dGVzXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGlzTGVhZk5vZGVcbiAqIEBwYXJhbSB7Ym9vbGVhbn0gZXNjYXBlRW50aXRpZXNcbiAqL1xuZnVuY3Rpb24gcGFyc2VUZXh0RGF0YSh2YWwsIHRhZ05hbWUsIGpQYXRoLCBkb250VHJpbSwgaGFzQXR0cmlidXRlcywgaXNMZWFmTm9kZSwgZXNjYXBlRW50aXRpZXMpIHtcbiAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgaWYgKHRoaXMub3B0aW9ucy50cmltVmFsdWVzICYmICFkb250VHJpbSkge1xuICAgICAgdmFsID0gdmFsLnRyaW0oKTtcbiAgICB9XG4gICAgaWYgKHZhbC5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoIWVzY2FwZUVudGl0aWVzKSB2YWwgPSB0aGlzLnJlcGxhY2VFbnRpdGllc1ZhbHVlKHZhbCwgdGFnTmFtZSwgalBhdGgpO1xuXG4gICAgICBjb25zdCBuZXd2YWwgPSB0aGlzLm9wdGlvbnMudGFnVmFsdWVQcm9jZXNzb3IodGFnTmFtZSwgdmFsLCBqUGF0aCwgaGFzQXR0cmlidXRlcywgaXNMZWFmTm9kZSk7XG4gICAgICBpZiAobmV3dmFsID09PSBudWxsIHx8IG5ld3ZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIC8vZG9uJ3QgcGFyc2VcbiAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIG5ld3ZhbCAhPT0gdHlwZW9mIHZhbCB8fCBuZXd2YWwgIT09IHZhbCkge1xuICAgICAgICAvL292ZXJ3cml0ZVxuICAgICAgICByZXR1cm4gbmV3dmFsO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMudHJpbVZhbHVlcykge1xuICAgICAgICByZXR1cm4gcGFyc2VWYWx1ZSh2YWwsIHRoaXMub3B0aW9ucy5wYXJzZVRhZ1ZhbHVlLCB0aGlzLm9wdGlvbnMubnVtYmVyUGFyc2VPcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHRyaW1tZWRWYWwgPSB2YWwudHJpbSgpO1xuICAgICAgICBpZiAodHJpbW1lZFZhbCA9PT0gdmFsKSB7XG4gICAgICAgICAgcmV0dXJuIHBhcnNlVmFsdWUodmFsLCB0aGlzLm9wdGlvbnMucGFyc2VUYWdWYWx1ZSwgdGhpcy5vcHRpb25zLm51bWJlclBhcnNlT3B0aW9ucyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHZhbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiByZXNvbHZlTmFtZVNwYWNlKHRhZ25hbWUpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5yZW1vdmVOU1ByZWZpeCkge1xuICAgIGNvbnN0IHRhZ3MgPSB0YWduYW1lLnNwbGl0KCc6Jyk7XG4gICAgY29uc3QgcHJlZml4ID0gdGFnbmFtZS5jaGFyQXQoMCkgPT09ICcvJyA/ICcvJyA6ICcnO1xuICAgIGlmICh0YWdzWzBdID09PSAneG1sbnMnKSB7XG4gICAgICByZXR1cm4gJyc7XG4gICAgfVxuICAgIGlmICh0YWdzLmxlbmd0aCA9PT0gMikge1xuICAgICAgdGFnbmFtZSA9IHByZWZpeCArIHRhZ3NbMV07XG4gICAgfVxuICB9XG4gIHJldHVybiB0YWduYW1lO1xufVxuXG4vL1RPRE86IGNoYW5nZSByZWdleCB0byBjYXB0dXJlIE5TXG4vL2NvbnN0IGF0dHJzUmVneCA9IG5ldyBSZWdFeHAoXCIoW1xcXFx3XFxcXC1cXFxcLlxcXFw6XSspXFxcXHMqPVxcXFxzKihbJ1xcXCJdKSgoLnxcXG4pKj8pXFxcXDJcIixcImdtXCIpO1xuY29uc3QgYXR0cnNSZWd4ID0gbmV3IFJlZ0V4cCgnKFteXFxcXHM9XSspXFxcXHMqKD1cXFxccyooW1xcJ1wiXSkoW1xcXFxzXFxcXFNdKj8pXFxcXDMpPycsICdnbScpO1xuXG5mdW5jdGlvbiBidWlsZEF0dHJpYnV0ZXNNYXAoYXR0clN0ciwgalBhdGgsIHRhZ05hbWUpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5pZ25vcmVBdHRyaWJ1dGVzICE9PSB0cnVlICYmIHR5cGVvZiBhdHRyU3RyID09PSAnc3RyaW5nJykge1xuICAgIC8vIGF0dHJTdHIgPSBhdHRyU3RyLnJlcGxhY2UoL1xccj9cXG4vZywgJyAnKTtcbiAgICAvL2F0dHJTdHIgPSBhdHRyU3RyIHx8IGF0dHJTdHIudHJpbSgpO1xuXG4gICAgY29uc3QgbWF0Y2hlcyA9IHV0aWwuZ2V0QWxsTWF0Y2hlcyhhdHRyU3RyLCBhdHRyc1JlZ3gpO1xuICAgIGNvbnN0IGxlbiA9IG1hdGNoZXMubGVuZ3RoOyAvL2Rvbid0IG1ha2UgaXQgaW5saW5lXG4gICAgY29uc3QgYXR0cnMgPSB7fTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBjb25zdCBhdHRyTmFtZSA9IHRoaXMucmVzb2x2ZU5hbWVTcGFjZShtYXRjaGVzW2ldWzFdKTtcbiAgICAgIGlmICh0aGlzLmlnbm9yZUF0dHJpYnV0ZXNGbihhdHRyTmFtZSwgalBhdGgpKSB7XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgICBsZXQgb2xkVmFsID0gbWF0Y2hlc1tpXVs0XTtcbiAgICAgIGxldCBhTmFtZSA9IHRoaXMub3B0aW9ucy5hdHRyaWJ1dGVOYW1lUHJlZml4ICsgYXR0ck5hbWU7XG4gICAgICBpZiAoYXR0ck5hbWUubGVuZ3RoKSB7XG4gICAgICAgIGlmICh0aGlzLm9wdGlvbnMudHJhbnNmb3JtQXR0cmlidXRlTmFtZSkge1xuICAgICAgICAgIGFOYW1lID0gdGhpcy5vcHRpb25zLnRyYW5zZm9ybUF0dHJpYnV0ZU5hbWUoYU5hbWUpO1xuICAgICAgICB9XG4gICAgICAgIGFOYW1lID0gc2FuaXRpemVOYW1lKGFOYW1lLCB0aGlzLm9wdGlvbnMpO1xuICAgICAgICBpZiAob2xkVmFsICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRyaW1WYWx1ZXMpIHtcbiAgICAgICAgICAgIG9sZFZhbCA9IG9sZFZhbC50cmltKCk7XG4gICAgICAgICAgfVxuICAgICAgICAgIG9sZFZhbCA9IHRoaXMucmVwbGFjZUVudGl0aWVzVmFsdWUob2xkVmFsLCB0YWdOYW1lLCBqUGF0aCk7XG4gICAgICAgICAgY29uc3QgbmV3VmFsID0gdGhpcy5vcHRpb25zLmF0dHJpYnV0ZVZhbHVlUHJvY2Vzc29yKGF0dHJOYW1lLCBvbGRWYWwsIGpQYXRoKTtcbiAgICAgICAgICBpZiAobmV3VmFsID09PSBudWxsIHx8IG5ld1ZhbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvL2Rvbid0IHBhcnNlXG4gICAgICAgICAgICBhdHRyc1thTmFtZV0gPSBvbGRWYWw7XG4gICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgbmV3VmFsICE9PSB0eXBlb2Ygb2xkVmFsIHx8IG5ld1ZhbCAhPT0gb2xkVmFsKSB7XG4gICAgICAgICAgICAvL292ZXJ3cml0ZVxuICAgICAgICAgICAgYXR0cnNbYU5hbWVdID0gbmV3VmFsO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL3BhcnNlXG4gICAgICAgICAgICBhdHRyc1thTmFtZV0gPSBwYXJzZVZhbHVlKFxuICAgICAgICAgICAgICBvbGRWYWwsXG4gICAgICAgICAgICAgIHRoaXMub3B0aW9ucy5wYXJzZUF0dHJpYnV0ZVZhbHVlLFxuICAgICAgICAgICAgICB0aGlzLm9wdGlvbnMubnVtYmVyUGFyc2VPcHRpb25zXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuYWxsb3dCb29sZWFuQXR0cmlidXRlcykge1xuICAgICAgICAgIGF0dHJzW2FOYW1lXSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKCFPYmplY3Qua2V5cyhhdHRycykubGVuZ3RoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLm9wdGlvbnMuYXR0cmlidXRlc0dyb3VwTmFtZSkge1xuICAgICAgY29uc3QgYXR0ckNvbGxlY3Rpb24gPSB7fTtcbiAgICAgIGF0dHJDb2xsZWN0aW9uW3RoaXMub3B0aW9ucy5hdHRyaWJ1dGVzR3JvdXBOYW1lXSA9IGF0dHJzO1xuICAgICAgcmV0dXJuIGF0dHJDb2xsZWN0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gYXR0cnNcbiAgfVxufVxuXG5jb25zdCBwYXJzZVhtbCA9IGZ1bmN0aW9uICh4bWxEYXRhKSB7XG4gIHhtbERhdGEgPSB4bWxEYXRhLnJlcGxhY2UoL1xcclxcbj8vZywgXCJcXG5cIik7IC8vVE9ETzogcmVtb3ZlIHRoaXMgbGluZVxuICBjb25zdCB4bWxPYmogPSBuZXcgeG1sTm9kZSgnIXhtbCcpO1xuICBsZXQgY3VycmVudE5vZGUgPSB4bWxPYmo7XG4gIGxldCB0ZXh0RGF0YSA9IFwiXCI7XG4gIGxldCBqUGF0aCA9IFwiXCI7XG5cbiAgLy8gUmVzZXQgZW50aXR5IGV4cGFuc2lvbiBjb3VudGVycyBmb3IgdGhpcyBkb2N1bWVudFxuICB0aGlzLmVudGl0eUV4cGFuc2lvbkNvdW50ID0gMDtcbiAgdGhpcy5jdXJyZW50RXhwYW5kZWRMZW5ndGggPSAwO1xuXG4gIGNvbnN0IGRvY1R5cGVSZWFkZXIgPSBuZXcgRG9jVHlwZVJlYWRlcih0aGlzLm9wdGlvbnMucHJvY2Vzc0VudGl0aWVzKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB4bWxEYXRhLmxlbmd0aDsgaSsrKSB7Ly9mb3IgZWFjaCBjaGFyIGluIFhNTCBkYXRhXG4gICAgY29uc3QgY2ggPSB4bWxEYXRhW2ldO1xuICAgIGlmIChjaCA9PT0gJzwnKSB7XG4gICAgICAvLyBjb25zdCBuZXh0SW5kZXggPSBpKzE7XG4gICAgICAvLyBjb25zdCBfMm5kQ2hhciA9IHhtbERhdGFbbmV4dEluZGV4XTtcbiAgICAgIGlmICh4bWxEYXRhW2kgKyAxXSA9PT0gJy8nKSB7Ly9DbG9zaW5nIFRhZ1xuICAgICAgICBjb25zdCBjbG9zZUluZGV4ID0gZmluZENsb3NpbmdJbmRleCh4bWxEYXRhLCBcIj5cIiwgaSwgXCJDbG9zaW5nIFRhZyBpcyBub3QgY2xvc2VkLlwiKVxuICAgICAgICBsZXQgdGFnTmFtZSA9IHhtbERhdGEuc3Vic3RyaW5nKGkgKyAyLCBjbG9zZUluZGV4KS50cmltKCk7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yZW1vdmVOU1ByZWZpeCkge1xuICAgICAgICAgIGNvbnN0IGNvbG9uSW5kZXggPSB0YWdOYW1lLmluZGV4T2YoXCI6XCIpO1xuICAgICAgICAgIGlmIChjb2xvbkluZGV4ICE9PSAtMSkge1xuICAgICAgICAgICAgdGFnTmFtZSA9IHRhZ05hbWUuc3Vic3RyKGNvbG9uSW5kZXggKyAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnRyYW5zZm9ybVRhZ05hbWUpIHtcbiAgICAgICAgICB0YWdOYW1lID0gdGhpcy5vcHRpb25zLnRyYW5zZm9ybVRhZ05hbWUodGFnTmFtZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY3VycmVudE5vZGUpIHtcbiAgICAgICAgICB0ZXh0RGF0YSA9IHRoaXMuc2F2ZVRleHRUb1BhcmVudFRhZyh0ZXh0RGF0YSwgY3VycmVudE5vZGUsIGpQYXRoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vY2hlY2sgaWYgbGFzdCB0YWcgb2YgbmVzdGVkIHRhZyB3YXMgdW5wYWlyZWQgdGFnXG4gICAgICAgIGNvbnN0IGxhc3RUYWdOYW1lID0galBhdGguc3Vic3RyaW5nKGpQYXRoLmxhc3RJbmRleE9mKFwiLlwiKSArIDEpO1xuICAgICAgICBpZiAodGFnTmFtZSAmJiB0aGlzLm9wdGlvbnMudW5wYWlyZWRUYWdzLmluZGV4T2YodGFnTmFtZSkgIT09IC0xKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnBhaXJlZCB0YWcgY2FuIG5vdCBiZSB1c2VkIGFzIGNsb3NpbmcgdGFnOiA8LyR7dGFnTmFtZX0+YCk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHByb3BJbmRleCA9IDBcbiAgICAgICAgaWYgKGxhc3RUYWdOYW1lICYmIHRoaXMub3B0aW9ucy51bnBhaXJlZFRhZ3MuaW5kZXhPZihsYXN0VGFnTmFtZSkgIT09IC0xKSB7XG4gICAgICAgICAgcHJvcEluZGV4ID0galBhdGgubGFzdEluZGV4T2YoJy4nLCBqUGF0aC5sYXN0SW5kZXhPZignLicpIC0gMSlcbiAgICAgICAgICB0aGlzLnRhZ3NOb2RlU3RhY2sucG9wKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvcEluZGV4ID0galBhdGgubGFzdEluZGV4T2YoXCIuXCIpO1xuICAgICAgICB9XG4gICAgICAgIGpQYXRoID0galBhdGguc3Vic3RyaW5nKDAsIHByb3BJbmRleCk7XG5cbiAgICAgICAgY3VycmVudE5vZGUgPSB0aGlzLnRhZ3NOb2RlU3RhY2sucG9wKCk7Ly9hdm9pZCByZWN1cnNpb24sIHNldCB0aGUgcGFyZW50IHRhZyBzY29wZVxuICAgICAgICB0ZXh0RGF0YSA9IFwiXCI7XG4gICAgICAgIGkgPSBjbG9zZUluZGV4O1xuICAgICAgfSBlbHNlIGlmICh4bWxEYXRhW2kgKyAxXSA9PT0gJz8nKSB7XG5cbiAgICAgICAgbGV0IHRhZ0RhdGEgPSByZWFkVGFnRXhwKHhtbERhdGEsIGksIGZhbHNlLCBcIj8+XCIpO1xuICAgICAgICBpZiAoIXRhZ0RhdGEpIHRocm93IG5ldyBFcnJvcihcIlBpIFRhZyBpcyBub3QgY2xvc2VkLlwiKTtcblxuICAgICAgICB0ZXh0RGF0YSA9IHRoaXMuc2F2ZVRleHRUb1BhcmVudFRhZyh0ZXh0RGF0YSwgY3VycmVudE5vZGUsIGpQYXRoKTtcbiAgICAgICAgaWYgKCh0aGlzLm9wdGlvbnMuaWdub3JlRGVjbGFyYXRpb24gJiYgdGFnRGF0YS50YWdOYW1lID09PSBcIj94bWxcIikgfHwgdGhpcy5vcHRpb25zLmlnbm9yZVBpVGFncykge1xuICAgICAgICAgIC8vZG8gbm90aGluZ1xuICAgICAgICB9IGVsc2Uge1xuXG4gICAgICAgICAgY29uc3QgY2hpbGROb2RlID0gbmV3IHhtbE5vZGUodGFnRGF0YS50YWdOYW1lKTtcbiAgICAgICAgICBjaGlsZE5vZGUuYWRkKHRoaXMub3B0aW9ucy50ZXh0Tm9kZU5hbWUsIFwiXCIpO1xuXG4gICAgICAgICAgaWYgKHRhZ0RhdGEudGFnTmFtZSAhPT0gdGFnRGF0YS50YWdFeHAgJiYgdGFnRGF0YS5hdHRyRXhwUHJlc2VudCkge1xuICAgICAgICAgICAgY2hpbGROb2RlW1wiOkBcIl0gPSB0aGlzLmJ1aWxkQXR0cmlidXRlc01hcCh0YWdEYXRhLnRhZ0V4cCwgalBhdGgsIHRhZ0RhdGEudGFnTmFtZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRoaXMuYWRkQ2hpbGQoY3VycmVudE5vZGUsIGNoaWxkTm9kZSwgalBhdGgsIGkpO1xuICAgICAgICB9XG5cblxuICAgICAgICBpID0gdGFnRGF0YS5jbG9zZUluZGV4ICsgMTtcbiAgICAgIH0gZWxzZSBpZiAoeG1sRGF0YS5zdWJzdHIoaSArIDEsIDMpID09PSAnIS0tJykge1xuICAgICAgICBjb25zdCBlbmRJbmRleCA9IGZpbmRDbG9zaW5nSW5kZXgoeG1sRGF0YSwgXCItLT5cIiwgaSArIDQsIFwiQ29tbWVudCBpcyBub3QgY2xvc2VkLlwiKVxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmNvbW1lbnRQcm9wTmFtZSkge1xuICAgICAgICAgIGNvbnN0IGNvbW1lbnQgPSB4bWxEYXRhLnN1YnN0cmluZyhpICsgNCwgZW5kSW5kZXggLSAyKTtcblxuICAgICAgICAgIHRleHREYXRhID0gdGhpcy5zYXZlVGV4dFRvUGFyZW50VGFnKHRleHREYXRhLCBjdXJyZW50Tm9kZSwgalBhdGgpO1xuXG4gICAgICAgICAgY3VycmVudE5vZGUuYWRkKHRoaXMub3B0aW9ucy5jb21tZW50UHJvcE5hbWUsIFt7IFt0aGlzLm9wdGlvbnMudGV4dE5vZGVOYW1lXTogY29tbWVudCB9XSk7XG4gICAgICAgIH1cbiAgICAgICAgaSA9IGVuZEluZGV4O1xuICAgICAgfSBlbHNlIGlmICh4bWxEYXRhLnN1YnN0cihpICsgMSwgMikgPT09ICchRCcpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZG9jVHlwZVJlYWRlci5yZWFkRG9jVHlwZSh4bWxEYXRhLCBpKTtcbiAgICAgICAgdGhpcy5kb2NUeXBlRW50aXRpZXMgPSByZXN1bHQuZW50aXRpZXM7XG4gICAgICAgIGkgPSByZXN1bHQuaTtcbiAgICAgIH0gZWxzZSBpZiAoeG1sRGF0YS5zdWJzdHIoaSArIDEsIDIpID09PSAnIVsnKSB7XG4gICAgICAgIGNvbnN0IGNsb3NlSW5kZXggPSBmaW5kQ2xvc2luZ0luZGV4KHhtbERhdGEsIFwiXV0+XCIsIGksIFwiQ0RBVEEgaXMgbm90IGNsb3NlZC5cIikgLSAyO1xuICAgICAgICBjb25zdCB0YWdFeHAgPSB4bWxEYXRhLnN1YnN0cmluZyhpICsgOSwgY2xvc2VJbmRleCk7XG5cbiAgICAgICAgdGV4dERhdGEgPSB0aGlzLnNhdmVUZXh0VG9QYXJlbnRUYWcodGV4dERhdGEsIGN1cnJlbnROb2RlLCBqUGF0aCk7XG5cbiAgICAgICAgbGV0IHZhbCA9IHRoaXMucGFyc2VUZXh0RGF0YSh0YWdFeHAsIGN1cnJlbnROb2RlLnRhZ25hbWUsIGpQYXRoLCB0cnVlLCBmYWxzZSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgICAgIGlmICh2YWwgPT0gdW5kZWZpbmVkKSB2YWwgPSBcIlwiO1xuXG4gICAgICAgIC8vY2RhdGEgc2hvdWxkIGJlIHNldCBldmVuIGlmIGl0IGlzIDAgbGVuZ3RoIHN0cmluZ1xuICAgICAgICBpZiAodGhpcy5vcHRpb25zLmNkYXRhUHJvcE5hbWUpIHtcbiAgICAgICAgICBjdXJyZW50Tm9kZS5hZGQodGhpcy5vcHRpb25zLmNkYXRhUHJvcE5hbWUsIFt7IFt0aGlzLm9wdGlvbnMudGV4dE5vZGVOYW1lXTogdGFnRXhwIH1dKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjdXJyZW50Tm9kZS5hZGQodGhpcy5vcHRpb25zLnRleHROb2RlTmFtZSwgdmFsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGkgPSBjbG9zZUluZGV4ICsgMjtcbiAgICAgIH0gZWxzZSB7Ly9PcGVuaW5nIHRhZ1xuICAgICAgICBsZXQgcmVzdWx0ID0gcmVhZFRhZ0V4cCh4bWxEYXRhLCBpLCB0aGlzLm9wdGlvbnMucmVtb3ZlTlNQcmVmaXgpO1xuICAgICAgICBsZXQgdGFnTmFtZSA9IHJlc3VsdC50YWdOYW1lO1xuICAgICAgICBjb25zdCByYXdUYWdOYW1lID0gcmVzdWx0LnJhd1RhZ05hbWU7XG4gICAgICAgIGxldCB0YWdFeHAgPSByZXN1bHQudGFnRXhwO1xuICAgICAgICBsZXQgYXR0ckV4cFByZXNlbnQgPSByZXN1bHQuYXR0ckV4cFByZXNlbnQ7XG4gICAgICAgIGxldCBjbG9zZUluZGV4ID0gcmVzdWx0LmNsb3NlSW5kZXg7XG5cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy50cmFuc2Zvcm1UYWdOYW1lKSB7XG4gICAgICAgICAgLy9jb25zb2xlLmxvZyh0YWdFeHAsIHRhZ05hbWUpXG4gICAgICAgICAgY29uc3QgbmV3VGFnTmFtZSA9IHRoaXMub3B0aW9ucy50cmFuc2Zvcm1UYWdOYW1lKHRhZ05hbWUpO1xuICAgICAgICAgIGlmICh0YWdFeHAgPT09IHRhZ05hbWUpIHtcbiAgICAgICAgICAgIHRhZ0V4cCA9IG5ld1RhZ05hbWVcbiAgICAgICAgICB9XG4gICAgICAgICAgdGFnTmFtZSA9IG5ld1RhZ05hbWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnN0cmljdFJlc2VydmVkTmFtZXMgJiZcbiAgICAgICAgICAodGFnTmFtZSA9PT0gdGhpcy5vcHRpb25zLmNvbW1lbnRQcm9wTmFtZVxuICAgICAgICAgICAgfHwgdGFnTmFtZSA9PT0gdGhpcy5vcHRpb25zLmNkYXRhUHJvcE5hbWVcbiAgICAgICAgICAgIHx8IHRhZ05hbWUgPT09IHRoaXMub3B0aW9ucy50ZXh0Tm9kZU5hbWVcbiAgICAgICAgICAgIHx8IHRhZ05hbWUgPT09IHRoaXMub3B0aW9ucy5hdHRyaWJ1dGVzR3JvdXBOYW1lXG4gICAgICAgICAgKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCB0YWcgbmFtZTogJHt0YWdOYW1lfWApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy9zYXZlIHRleHQgYXMgY2hpbGQgbm9kZVxuICAgICAgICBpZiAoY3VycmVudE5vZGUgJiYgdGV4dERhdGEpIHtcbiAgICAgICAgICBpZiAoY3VycmVudE5vZGUudGFnbmFtZSAhPT0gJyF4bWwnKSB7XG4gICAgICAgICAgICAvL3doZW4gbmVzdGVkIHRhZyBpcyBmb3VuZFxuICAgICAgICAgICAgdGV4dERhdGEgPSB0aGlzLnNhdmVUZXh0VG9QYXJlbnRUYWcodGV4dERhdGEsIGN1cnJlbnROb2RlLCBqUGF0aCwgZmFsc2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8vY2hlY2sgaWYgbGFzdCB0YWcgd2FzIHVucGFpcmVkIHRhZ1xuICAgICAgICBjb25zdCBsYXN0VGFnID0gY3VycmVudE5vZGU7XG4gICAgICAgIGlmIChsYXN0VGFnICYmIHRoaXMub3B0aW9ucy51bnBhaXJlZFRhZ3MuaW5kZXhPZihsYXN0VGFnLnRhZ25hbWUpICE9PSAtMSkge1xuICAgICAgICAgIGN1cnJlbnROb2RlID0gdGhpcy50YWdzTm9kZVN0YWNrLnBvcCgpO1xuICAgICAgICAgIGpQYXRoID0galBhdGguc3Vic3RyaW5nKDAsIGpQYXRoLmxhc3RJbmRleE9mKFwiLlwiKSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRhZ05hbWUgIT09IHhtbE9iai50YWduYW1lKSB7XG4gICAgICAgICAgalBhdGggKz0galBhdGggPyBcIi5cIiArIHRhZ05hbWUgOiB0YWdOYW1lO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHN0YXJ0SW5kZXggPSBpO1xuICAgICAgICBpZiAodGhpcy5pc0l0U3RvcE5vZGUodGhpcy5zdG9wTm9kZXNFeGFjdCwgdGhpcy5zdG9wTm9kZXNXaWxkY2FyZCwgalBhdGgsIHRhZ05hbWUpKSB7XG4gICAgICAgICAgbGV0IHRhZ0NvbnRlbnQgPSBcIlwiO1xuICAgICAgICAgIC8vc2VsZi1jbG9zaW5nIHRhZ1xuICAgICAgICAgIGlmICh0YWdFeHAubGVuZ3RoID4gMCAmJiB0YWdFeHAubGFzdEluZGV4T2YoXCIvXCIpID09PSB0YWdFeHAubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgaWYgKHRhZ05hbWVbdGFnTmFtZS5sZW5ndGggLSAxXSA9PT0gXCIvXCIpIHsgLy9yZW1vdmUgdHJhaWxpbmcgJy8nXG4gICAgICAgICAgICAgIHRhZ05hbWUgPSB0YWdOYW1lLnN1YnN0cigwLCB0YWdOYW1lLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICBqUGF0aCA9IGpQYXRoLnN1YnN0cigwLCBqUGF0aC5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgdGFnRXhwID0gdGFnTmFtZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRhZ0V4cCA9IHRhZ0V4cC5zdWJzdHIoMCwgdGFnRXhwLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaSA9IHJlc3VsdC5jbG9zZUluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvL3VucGFpcmVkIHRhZ1xuICAgICAgICAgIGVsc2UgaWYgKHRoaXMub3B0aW9ucy51bnBhaXJlZFRhZ3MuaW5kZXhPZih0YWdOYW1lKSAhPT0gLTEpIHtcblxuICAgICAgICAgICAgaSA9IHJlc3VsdC5jbG9zZUluZGV4O1xuICAgICAgICAgIH1cbiAgICAgICAgICAvL25vcm1hbCB0YWdcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vcmVhZCB1bnRpbCBjbG9zaW5nIHRhZyBpcyBmb3VuZFxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdGhpcy5yZWFkU3RvcE5vZGVEYXRhKHhtbERhdGEsIHJhd1RhZ05hbWUsIGNsb3NlSW5kZXggKyAxKTtcbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB0aHJvdyBuZXcgRXJyb3IoYFVuZXhwZWN0ZWQgZW5kIG9mICR7cmF3VGFnTmFtZX1gKTtcbiAgICAgICAgICAgIGkgPSByZXN1bHQuaTtcbiAgICAgICAgICAgIHRhZ0NvbnRlbnQgPSByZXN1bHQudGFnQ29udGVudDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBjaGlsZE5vZGUgPSBuZXcgeG1sTm9kZSh0YWdOYW1lKTtcbiAgICAgICAgICBpZiAodGFnTmFtZSAhPT0gdGFnRXhwICYmIGF0dHJFeHBQcmVzZW50KSB7XG4gICAgICAgICAgICBjaGlsZE5vZGVbXCI6QFwiXSA9IHRoaXMuYnVpbGRBdHRyaWJ1dGVzTWFwKHRhZ0V4cCwgalBhdGgsIHRhZ05hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGFnQ29udGVudCkge1xuICAgICAgICAgICAgdGFnQ29udGVudCA9IHRoaXMucGFyc2VUZXh0RGF0YSh0YWdDb250ZW50LCB0YWdOYW1lLCBqUGF0aCwgdHJ1ZSwgYXR0ckV4cFByZXNlbnQsIHRydWUsIHRydWUpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGpQYXRoID0galBhdGguc3Vic3RyKDAsIGpQYXRoLmxhc3RJbmRleE9mKFwiLlwiKSk7XG4gICAgICAgICAgY2hpbGROb2RlLmFkZCh0aGlzLm9wdGlvbnMudGV4dE5vZGVOYW1lLCB0YWdDb250ZW50KTtcblxuICAgICAgICAgIHRoaXMuYWRkQ2hpbGQoY3VycmVudE5vZGUsIGNoaWxkTm9kZSwgalBhdGgsIHN0YXJ0SW5kZXgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vc2VsZkNsb3NpbmcgdGFnXG4gICAgICAgICAgaWYgKHRhZ0V4cC5sZW5ndGggPiAwICYmIHRhZ0V4cC5sYXN0SW5kZXhPZihcIi9cIikgPT09IHRhZ0V4cC5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICBpZiAodGFnTmFtZVt0YWdOYW1lLmxlbmd0aCAtIDFdID09PSBcIi9cIikgeyAvL3JlbW92ZSB0cmFpbGluZyAnLydcbiAgICAgICAgICAgICAgdGFnTmFtZSA9IHRhZ05hbWUuc3Vic3RyKDAsIHRhZ05hbWUubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICAgIGpQYXRoID0galBhdGguc3Vic3RyKDAsIGpQYXRoLmxlbmd0aCAtIDEpO1xuICAgICAgICAgICAgICB0YWdFeHAgPSB0YWdOYW1lO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgdGFnRXhwID0gdGFnRXhwLnN1YnN0cigwLCB0YWdFeHAubGVuZ3RoIC0gMSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMudHJhbnNmb3JtVGFnTmFtZSkge1xuICAgICAgICAgICAgICBjb25zdCBuZXdUYWdOYW1lID0gdGhpcy5vcHRpb25zLnRyYW5zZm9ybVRhZ05hbWUodGFnTmFtZSk7XG4gICAgICAgICAgICAgIGlmICh0YWdFeHAgPT09IHRhZ05hbWUpIHtcbiAgICAgICAgICAgICAgICB0YWdFeHAgPSBuZXdUYWdOYW1lXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdGFnTmFtZSA9IG5ld1RhZ05hbWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5ldyB4bWxOb2RlKHRhZ05hbWUpO1xuICAgICAgICAgICAgaWYgKHRhZ05hbWUgIT09IHRhZ0V4cCAmJiBhdHRyRXhwUHJlc2VudCkge1xuICAgICAgICAgICAgICBjaGlsZE5vZGVbXCI6QFwiXSA9IHRoaXMuYnVpbGRBdHRyaWJ1dGVzTWFwKHRhZ0V4cCwgalBhdGgsIHRhZ05hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hZGRDaGlsZChjdXJyZW50Tm9kZSwgY2hpbGROb2RlLCBqUGF0aCwgc3RhcnRJbmRleCk7XG4gICAgICAgICAgICBqUGF0aCA9IGpQYXRoLnN1YnN0cigwLCBqUGF0aC5sYXN0SW5kZXhPZihcIi5cIikpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIGlmICh0aGlzLm9wdGlvbnMudW5wYWlyZWRUYWdzLmluZGV4T2YodGFnTmFtZSkgIT09IC0xKSB7Ly91bnBhaXJlZCB0YWdcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5ldyB4bWxOb2RlKHRhZ05hbWUpO1xuICAgICAgICAgICAgaWYgKHRhZ05hbWUgIT09IHRhZ0V4cCAmJiBhdHRyRXhwUHJlc2VudCkge1xuICAgICAgICAgICAgICBjaGlsZE5vZGVbXCI6QFwiXSA9IHRoaXMuYnVpbGRBdHRyaWJ1dGVzTWFwKHRhZ0V4cCwgalBhdGgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5hZGRDaGlsZChjdXJyZW50Tm9kZSwgY2hpbGROb2RlLCBqUGF0aCwgc3RhcnRJbmRleCk7XG4gICAgICAgICAgICBqUGF0aCA9IGpQYXRoLnN1YnN0cigwLCBqUGF0aC5sYXN0SW5kZXhPZihcIi5cIikpO1xuICAgICAgICAgICAgaSA9IHJlc3VsdC5jbG9zZUluZGV4O1xuICAgICAgICAgICAgLy8gQ29udGludWUgdG8gbmV4dCBpdGVyYXRpb24gd2l0aG91dCBjaGFuZ2luZyBjdXJyZW50Tm9kZVxuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vb3BlbmluZyB0YWdcbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIGNvbnN0IGNoaWxkTm9kZSA9IG5ldyB4bWxOb2RlKHRhZ05hbWUpO1xuICAgICAgICAgICAgaWYgKHRoaXMudGFnc05vZGVTdGFjay5sZW5ndGggPiB0aGlzLm9wdGlvbnMubWF4TmVzdGVkVGFncykge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNYXhpbXVtIG5lc3RlZCB0YWdzIGV4Y2VlZGVkXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy50YWdzTm9kZVN0YWNrLnB1c2goY3VycmVudE5vZGUpO1xuXG4gICAgICAgICAgICBpZiAodGFnTmFtZSAhPT0gdGFnRXhwICYmIGF0dHJFeHBQcmVzZW50KSB7XG4gICAgICAgICAgICAgIGNoaWxkTm9kZVtcIjpAXCJdID0gdGhpcy5idWlsZEF0dHJpYnV0ZXNNYXAodGFnRXhwLCBqUGF0aCwgdGFnTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmFkZENoaWxkKGN1cnJlbnROb2RlLCBjaGlsZE5vZGUsIGpQYXRoKVxuICAgICAgICAgICAgY3VycmVudE5vZGUgPSBjaGlsZE5vZGU7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRleHREYXRhID0gXCJcIjtcbiAgICAgICAgICBpID0gY2xvc2VJbmRleDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0ZXh0RGF0YSArPSB4bWxEYXRhW2ldO1xuICAgIH1cbiAgfVxuICByZXR1cm4geG1sT2JqLmNoaWxkO1xufVxuXG5mdW5jdGlvbiBhZGRDaGlsZChjdXJyZW50Tm9kZSwgY2hpbGROb2RlLCBqUGF0aCwgc3RhcnRJbmRleCkge1xuICAvLyB1bnNldCBzdGFydEluZGV4IGlmIG5vdCByZXF1ZXN0ZWRcbiAgaWYgKCF0aGlzLm9wdGlvbnMuY2FwdHVyZU1ldGFEYXRhKSBzdGFydEluZGV4ID0gdW5kZWZpbmVkO1xuICBjb25zdCByZXN1bHQgPSB0aGlzLm9wdGlvbnMudXBkYXRlVGFnKGNoaWxkTm9kZS50YWduYW1lLCBqUGF0aCwgY2hpbGROb2RlW1wiOkBcIl0pXG4gIGlmIChyZXN1bHQgPT09IGZhbHNlKSB7XG4gICAgLy9kbyBub3RoaW5nXG4gIH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdCA9PT0gXCJzdHJpbmdcIikge1xuICAgIGNoaWxkTm9kZS50YWduYW1lID0gcmVzdWx0XG4gICAgY3VycmVudE5vZGUuYWRkQ2hpbGQoY2hpbGROb2RlLCBzdGFydEluZGV4KTtcbiAgfSBlbHNlIHtcbiAgICBjdXJyZW50Tm9kZS5hZGRDaGlsZChjaGlsZE5vZGUsIHN0YXJ0SW5kZXgpO1xuICB9XG59XG5cbmNvbnN0IHJlcGxhY2VFbnRpdGllc1ZhbHVlID0gZnVuY3Rpb24gKHZhbCwgdGFnTmFtZSwgalBhdGgpIHtcbiAgLy8gUGVyZm9ybWFuY2Ugb3B0aW1pemF0aW9uOiBFYXJseSByZXR1cm4gaWYgbm8gZW50aXRpZXMgdG8gcmVwbGFjZVxuICBpZiAodmFsLmluZGV4T2YoJyYnKSA9PT0gLTEpIHtcbiAgICByZXR1cm4gdmFsO1xuICB9XG5cbiAgY29uc3QgZW50aXR5Q29uZmlnID0gdGhpcy5vcHRpb25zLnByb2Nlc3NFbnRpdGllcztcblxuICBpZiAoIWVudGl0eUNvbmZpZy5lbmFibGVkKSB7XG4gICAgcmV0dXJuIHZhbDtcbiAgfVxuXG4gIC8vIENoZWNrIHRhZy1zcGVjaWZpYyBmaWx0ZXJpbmdcbiAgaWYgKGVudGl0eUNvbmZpZy5hbGxvd2VkVGFncykge1xuICAgIGlmICghZW50aXR5Q29uZmlnLmFsbG93ZWRUYWdzLmluY2x1ZGVzKHRhZ05hbWUpKSB7XG4gICAgICByZXR1cm4gdmFsOyAvLyBTa2lwIGVudGl0eSByZXBsYWNlbWVudCBmb3IgY3VycmVudCB0YWcgYXMgbm90IHNldFxuICAgIH1cbiAgfVxuXG4gIGlmIChlbnRpdHlDb25maWcudGFnRmlsdGVyKSB7XG4gICAgaWYgKCFlbnRpdHlDb25maWcudGFnRmlsdGVyKHRhZ05hbWUsIGpQYXRoKSkge1xuICAgICAgcmV0dXJuIHZhbDsgLy8gU2tpcCBiYXNlZCBvbiBjdXN0b20gZmlsdGVyXG4gICAgfVxuICB9XG5cbiAgLy8gUmVwbGFjZSBET0NUWVBFIGVudGl0aWVzXG4gIGZvciAobGV0IGVudGl0eU5hbWUgaW4gdGhpcy5kb2NUeXBlRW50aXRpZXMpIHtcbiAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmRvY1R5cGVFbnRpdGllc1tlbnRpdHlOYW1lXTtcbiAgICBjb25zdCBtYXRjaGVzID0gdmFsLm1hdGNoKGVudGl0eS5yZWd4KTtcblxuICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAvLyBUcmFjayBleHBhbnNpb25zXG4gICAgICB0aGlzLmVudGl0eUV4cGFuc2lvbkNvdW50ICs9IG1hdGNoZXMubGVuZ3RoO1xuXG4gICAgICAvLyBDaGVjayBleHBhbnNpb24gbGltaXRcbiAgICAgIGlmIChlbnRpdHlDb25maWcubWF4VG90YWxFeHBhbnNpb25zICYmXG4gICAgICAgIHRoaXMuZW50aXR5RXhwYW5zaW9uQ291bnQgPiBlbnRpdHlDb25maWcubWF4VG90YWxFeHBhbnNpb25zKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgRW50aXR5IGV4cGFuc2lvbiBsaW1pdCBleGNlZWRlZDogJHt0aGlzLmVudGl0eUV4cGFuc2lvbkNvdW50fSA+ICR7ZW50aXR5Q29uZmlnLm1heFRvdGFsRXhwYW5zaW9uc31gXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIC8vIFN0b3JlIGxlbmd0aCBiZWZvcmUgcmVwbGFjZW1lbnRcbiAgICAgIGNvbnN0IGxlbmd0aEJlZm9yZSA9IHZhbC5sZW5ndGg7XG4gICAgICB2YWwgPSB2YWwucmVwbGFjZShlbnRpdHkucmVneCwgZW50aXR5LnZhbCk7XG5cbiAgICAgIC8vIENoZWNrIGV4cGFuZGVkIGxlbmd0aCBpbW1lZGlhdGVseSBhZnRlciByZXBsYWNlbWVudFxuICAgICAgaWYgKGVudGl0eUNvbmZpZy5tYXhFeHBhbmRlZExlbmd0aCkge1xuICAgICAgICB0aGlzLmN1cnJlbnRFeHBhbmRlZExlbmd0aCArPSAodmFsLmxlbmd0aCAtIGxlbmd0aEJlZm9yZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuY3VycmVudEV4cGFuZGVkTGVuZ3RoID4gZW50aXR5Q29uZmlnLm1heEV4cGFuZGVkTGVuZ3RoKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgYFRvdGFsIGV4cGFuZGVkIGNvbnRlbnQgc2l6ZSBleGNlZWRlZDogJHt0aGlzLmN1cnJlbnRFeHBhbmRlZExlbmd0aH0gPiAke2VudGl0eUNvbmZpZy5tYXhFeHBhbmRlZExlbmd0aH1gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBpZiAodmFsLmluZGV4T2YoJyYnKSA9PT0gLTEpIHJldHVybiB2YWw7ICAvLyBFYXJseSBleGl0XG5cbiAgLy8gUmVwbGFjZSBzdGFuZGFyZCBlbnRpdGllc1xuICBmb3IgKGNvbnN0IGVudGl0eU5hbWUgb2YgT2JqZWN0LmtleXModGhpcy5sYXN0RW50aXRpZXMpKSB7XG4gICAgY29uc3QgZW50aXR5ID0gdGhpcy5sYXN0RW50aXRpZXNbZW50aXR5TmFtZV07XG4gICAgY29uc3QgbWF0Y2hlcyA9IHZhbC5tYXRjaChlbnRpdHkucmVnZXgpO1xuICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICB0aGlzLmVudGl0eUV4cGFuc2lvbkNvdW50ICs9IG1hdGNoZXMubGVuZ3RoO1xuICAgICAgaWYgKGVudGl0eUNvbmZpZy5tYXhUb3RhbEV4cGFuc2lvbnMgJiZcbiAgICAgICAgdGhpcy5lbnRpdHlFeHBhbnNpb25Db3VudCA+IGVudGl0eUNvbmZpZy5tYXhUb3RhbEV4cGFuc2lvbnMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBFbnRpdHkgZXhwYW5zaW9uIGxpbWl0IGV4Y2VlZGVkOiAke3RoaXMuZW50aXR5RXhwYW5zaW9uQ291bnR9ID4gJHtlbnRpdHlDb25maWcubWF4VG90YWxFeHBhbnNpb25zfWBcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdmFsID0gdmFsLnJlcGxhY2UoZW50aXR5LnJlZ2V4LCBlbnRpdHkudmFsKTtcbiAgfVxuICBpZiAodmFsLmluZGV4T2YoJyYnKSA9PT0gLTEpIHJldHVybiB2YWw7ICAvLyBFYXJseSBleGl0XG5cbiAgLy8gUmVwbGFjZSBIVE1MIGVudGl0aWVzIGlmIGVuYWJsZWRcbiAgaWYgKHRoaXMub3B0aW9ucy5odG1sRW50aXRpZXMpIHtcbiAgICBmb3IgKGNvbnN0IGVudGl0eU5hbWUgb2YgT2JqZWN0LmtleXModGhpcy5odG1sRW50aXRpZXMpKSB7XG4gICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLmh0bWxFbnRpdGllc1tlbnRpdHlOYW1lXTtcbiAgICAgIGNvbnN0IG1hdGNoZXMgPSB2YWwubWF0Y2goZW50aXR5LnJlZ2V4KTtcbiAgICAgIGlmIChtYXRjaGVzKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2cobWF0Y2hlcyk7XG4gICAgICAgIHRoaXMuZW50aXR5RXhwYW5zaW9uQ291bnQgKz0gbWF0Y2hlcy5sZW5ndGg7XG4gICAgICAgIGlmIChlbnRpdHlDb25maWcubWF4VG90YWxFeHBhbnNpb25zICYmXG4gICAgICAgICAgdGhpcy5lbnRpdHlFeHBhbnNpb25Db3VudCA+IGVudGl0eUNvbmZpZy5tYXhUb3RhbEV4cGFuc2lvbnMpIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICBgRW50aXR5IGV4cGFuc2lvbiBsaW1pdCBleGNlZWRlZDogJHt0aGlzLmVudGl0eUV4cGFuc2lvbkNvdW50fSA+ICR7ZW50aXR5Q29uZmlnLm1heFRvdGFsRXhwYW5zaW9uc31gXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFsID0gdmFsLnJlcGxhY2UoZW50aXR5LnJlZ2V4LCBlbnRpdHkudmFsKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZXBsYWNlIGFtcGVyc2FuZCBlbnRpdHkgbGFzdFxuICB2YWwgPSB2YWwucmVwbGFjZSh0aGlzLmFtcEVudGl0eS5yZWdleCwgdGhpcy5hbXBFbnRpdHkudmFsKTtcblxuICByZXR1cm4gdmFsO1xufVxuXG5mdW5jdGlvbiBzYXZlVGV4dFRvUGFyZW50VGFnKHRleHREYXRhLCBwYXJlbnROb2RlLCBqUGF0aCwgaXNMZWFmTm9kZSkge1xuICBpZiAodGV4dERhdGEpIHsgLy9zdG9yZSBwcmV2aW91c2x5IGNvbGxlY3RlZCBkYXRhIGFzIHRleHROb2RlXG4gICAgaWYgKGlzTGVhZk5vZGUgPT09IHVuZGVmaW5lZCkgaXNMZWFmTm9kZSA9IHBhcmVudE5vZGUuY2hpbGQubGVuZ3RoID09PSAwXG5cbiAgICB0ZXh0RGF0YSA9IHRoaXMucGFyc2VUZXh0RGF0YSh0ZXh0RGF0YSxcbiAgICAgIHBhcmVudE5vZGUudGFnbmFtZSxcbiAgICAgIGpQYXRoLFxuICAgICAgZmFsc2UsXG4gICAgICBwYXJlbnROb2RlW1wiOkBcIl0gPyBPYmplY3Qua2V5cyhwYXJlbnROb2RlW1wiOkBcIl0pLmxlbmd0aCAhPT0gMCA6IGZhbHNlLFxuICAgICAgaXNMZWFmTm9kZSk7XG5cbiAgICBpZiAodGV4dERhdGEgIT09IHVuZGVmaW5lZCAmJiB0ZXh0RGF0YSAhPT0gXCJcIilcbiAgICAgIHBhcmVudE5vZGUuYWRkKHRoaXMub3B0aW9ucy50ZXh0Tm9kZU5hbWUsIHRleHREYXRhKTtcbiAgICB0ZXh0RGF0YSA9IFwiXCI7XG4gIH1cbiAgcmV0dXJuIHRleHREYXRhO1xufVxuXG4vL1RPRE86IHVzZSBqUGF0aCB0byBzaW1wbGlmeSB0aGUgbG9naWNcbi8qKlxuICogQHBhcmFtIHtTZXR9IHN0b3BOb2Rlc0V4YWN0XG4gKiBAcGFyYW0ge1NldH0gc3RvcE5vZGVzV2lsZGNhcmRcbiAqIEBwYXJhbSB7c3RyaW5nfSBqUGF0aFxuICogQHBhcmFtIHtzdHJpbmd9IGN1cnJlbnRUYWdOYW1lXG4gKi9cbmZ1bmN0aW9uIGlzSXRTdG9wTm9kZShzdG9wTm9kZXNFeGFjdCwgc3RvcE5vZGVzV2lsZGNhcmQsIGpQYXRoLCBjdXJyZW50VGFnTmFtZSkge1xuICBpZiAoc3RvcE5vZGVzV2lsZGNhcmQgJiYgc3RvcE5vZGVzV2lsZGNhcmQuaGFzKGN1cnJlbnRUYWdOYW1lKSkgcmV0dXJuIHRydWU7XG4gIGlmIChzdG9wTm9kZXNFeGFjdCAmJiBzdG9wTm9kZXNFeGFjdC5oYXMoalBhdGgpKSByZXR1cm4gdHJ1ZTtcbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIFJldHVybnMgdGhlIHRhZyBFeHByZXNzaW9uIGFuZCB3aGVyZSBpdCBpcyBlbmRpbmcgaGFuZGxpbmcgc2luZ2xlLWRvdWJsZSBxdW90ZXMgc2l0dWF0aW9uXG4gKiBAcGFyYW0ge3N0cmluZ30geG1sRGF0YSBcbiAqIEBwYXJhbSB7bnVtYmVyfSBpIHN0YXJ0aW5nIGluZGV4XG4gKiBAcmV0dXJucyBcbiAqL1xuZnVuY3Rpb24gdGFnRXhwV2l0aENsb3NpbmdJbmRleCh4bWxEYXRhLCBpLCBjbG9zaW5nQ2hhciA9IFwiPlwiKSB7XG4gIGxldCBhdHRyQm91bmRhcnk7XG4gIGxldCB0YWdFeHAgPSBcIlwiO1xuICBmb3IgKGxldCBpbmRleCA9IGk7IGluZGV4IDwgeG1sRGF0YS5sZW5ndGg7IGluZGV4KyspIHtcbiAgICBsZXQgY2ggPSB4bWxEYXRhW2luZGV4XTtcbiAgICBpZiAoYXR0ckJvdW5kYXJ5KSB7XG4gICAgICBpZiAoY2ggPT09IGF0dHJCb3VuZGFyeSkgYXR0ckJvdW5kYXJ5ID0gXCJcIjsvL3Jlc2V0XG4gICAgfSBlbHNlIGlmIChjaCA9PT0gJ1wiJyB8fCBjaCA9PT0gXCInXCIpIHtcbiAgICAgIGF0dHJCb3VuZGFyeSA9IGNoO1xuICAgIH0gZWxzZSBpZiAoY2ggPT09IGNsb3NpbmdDaGFyWzBdKSB7XG4gICAgICBpZiAoY2xvc2luZ0NoYXJbMV0pIHtcbiAgICAgICAgaWYgKHhtbERhdGFbaW5kZXggKyAxXSA9PT0gY2xvc2luZ0NoYXJbMV0pIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgZGF0YTogdGFnRXhwLFxuICAgICAgICAgICAgaW5kZXg6IGluZGV4XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIGRhdGE6IHRhZ0V4cCxcbiAgICAgICAgICBpbmRleDogaW5kZXhcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY2ggPT09ICdcXHQnKSB7XG4gICAgICBjaCA9IFwiIFwiXG4gICAgfVxuICAgIHRhZ0V4cCArPSBjaDtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kQ2xvc2luZ0luZGV4KHhtbERhdGEsIHN0ciwgaSwgZXJyTXNnKSB7XG4gIGNvbnN0IGNsb3NpbmdJbmRleCA9IHhtbERhdGEuaW5kZXhPZihzdHIsIGkpO1xuICBpZiAoY2xvc2luZ0luZGV4ID09PSAtMSkge1xuICAgIHRocm93IG5ldyBFcnJvcihlcnJNc2cpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGNsb3NpbmdJbmRleCArIHN0ci5sZW5ndGggLSAxO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlYWRUYWdFeHAoeG1sRGF0YSwgaSwgcmVtb3ZlTlNQcmVmaXgsIGNsb3NpbmdDaGFyID0gXCI+XCIpIHtcbiAgY29uc3QgcmVzdWx0ID0gdGFnRXhwV2l0aENsb3NpbmdJbmRleCh4bWxEYXRhLCBpICsgMSwgY2xvc2luZ0NoYXIpO1xuICBpZiAoIXJlc3VsdCkgcmV0dXJuO1xuICBsZXQgdGFnRXhwID0gcmVzdWx0LmRhdGE7XG4gIGNvbnN0IGNsb3NlSW5kZXggPSByZXN1bHQuaW5kZXg7XG4gIGNvbnN0IHNlcGFyYXRvckluZGV4ID0gdGFnRXhwLnNlYXJjaCgvXFxzLyk7XG4gIGxldCB0YWdOYW1lID0gdGFnRXhwO1xuICBsZXQgYXR0ckV4cFByZXNlbnQgPSB0cnVlO1xuICBpZiAoc2VwYXJhdG9ySW5kZXggIT09IC0xKSB7Ly9zZXBhcmF0ZSB0YWcgbmFtZSBhbmQgYXR0cmlidXRlcyBleHByZXNzaW9uXG4gICAgdGFnTmFtZSA9IHRhZ0V4cC5zdWJzdHJpbmcoMCwgc2VwYXJhdG9ySW5kZXgpO1xuICAgIHRhZ0V4cCA9IHRhZ0V4cC5zdWJzdHJpbmcoc2VwYXJhdG9ySW5kZXggKyAxKS50cmltU3RhcnQoKTtcbiAgfVxuXG4gIGNvbnN0IHJhd1RhZ05hbWUgPSB0YWdOYW1lO1xuICBpZiAocmVtb3ZlTlNQcmVmaXgpIHtcbiAgICBjb25zdCBjb2xvbkluZGV4ID0gdGFnTmFtZS5pbmRleE9mKFwiOlwiKTtcbiAgICBpZiAoY29sb25JbmRleCAhPT0gLTEpIHtcbiAgICAgIHRhZ05hbWUgPSB0YWdOYW1lLnN1YnN0cihjb2xvbkluZGV4ICsgMSk7XG4gICAgICBhdHRyRXhwUHJlc2VudCA9IHRhZ05hbWUgIT09IHJlc3VsdC5kYXRhLnN1YnN0cihjb2xvbkluZGV4ICsgMSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHtcbiAgICB0YWdOYW1lOiB0YWdOYW1lLFxuICAgIHRhZ0V4cDogdGFnRXhwLFxuICAgIGNsb3NlSW5kZXg6IGNsb3NlSW5kZXgsXG4gICAgYXR0ckV4cFByZXNlbnQ6IGF0dHJFeHBQcmVzZW50LFxuICAgIHJhd1RhZ05hbWU6IHJhd1RhZ05hbWUsXG4gIH1cbn1cbi8qKlxuICogZmluZCBwYWlyZWQgdGFnIGZvciBhIHN0b3Agbm9kZVxuICogQHBhcmFtIHtzdHJpbmd9IHhtbERhdGEgXG4gKiBAcGFyYW0ge3N0cmluZ30gdGFnTmFtZSBcbiAqIEBwYXJhbSB7bnVtYmVyfSBpIFxuICovXG5mdW5jdGlvbiByZWFkU3RvcE5vZGVEYXRhKHhtbERhdGEsIHRhZ05hbWUsIGkpIHtcbiAgY29uc3Qgc3RhcnRJbmRleCA9IGk7XG4gIC8vIFN0YXJ0aW5nIGF0IDEgc2luY2Ugd2UgYWxyZWFkeSBoYXZlIGFuIG9wZW4gdGFnXG4gIGxldCBvcGVuVGFnQ291bnQgPSAxO1xuXG4gIGZvciAoOyBpIDwgeG1sRGF0YS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh4bWxEYXRhW2ldID09PSBcIjxcIikge1xuICAgICAgaWYgKHhtbERhdGFbaSArIDFdID09PSBcIi9cIikgey8vY2xvc2UgdGFnXG4gICAgICAgIGNvbnN0IGNsb3NlSW5kZXggPSBmaW5kQ2xvc2luZ0luZGV4KHhtbERhdGEsIFwiPlwiLCBpLCBgJHt0YWdOYW1lfSBpcyBub3QgY2xvc2VkYCk7XG4gICAgICAgIGxldCBjbG9zZVRhZ05hbWUgPSB4bWxEYXRhLnN1YnN0cmluZyhpICsgMiwgY2xvc2VJbmRleCkudHJpbSgpO1xuICAgICAgICBpZiAoY2xvc2VUYWdOYW1lID09PSB0YWdOYW1lKSB7XG4gICAgICAgICAgb3BlblRhZ0NvdW50LS07XG4gICAgICAgICAgaWYgKG9wZW5UYWdDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgdGFnQ29udGVudDogeG1sRGF0YS5zdWJzdHJpbmcoc3RhcnRJbmRleCwgaSksXG4gICAgICAgICAgICAgIGk6IGNsb3NlSW5kZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaSA9IGNsb3NlSW5kZXg7XG4gICAgICB9IGVsc2UgaWYgKHhtbERhdGFbaSArIDFdID09PSAnPycpIHtcbiAgICAgICAgY29uc3QgY2xvc2VJbmRleCA9IGZpbmRDbG9zaW5nSW5kZXgoeG1sRGF0YSwgXCI/PlwiLCBpICsgMSwgXCJTdG9wTm9kZSBpcyBub3QgY2xvc2VkLlwiKVxuICAgICAgICBpID0gY2xvc2VJbmRleDtcbiAgICAgIH0gZWxzZSBpZiAoeG1sRGF0YS5zdWJzdHIoaSArIDEsIDMpID09PSAnIS0tJykge1xuICAgICAgICBjb25zdCBjbG9zZUluZGV4ID0gZmluZENsb3NpbmdJbmRleCh4bWxEYXRhLCBcIi0tPlwiLCBpICsgMywgXCJTdG9wTm9kZSBpcyBub3QgY2xvc2VkLlwiKVxuICAgICAgICBpID0gY2xvc2VJbmRleDtcbiAgICAgIH0gZWxzZSBpZiAoeG1sRGF0YS5zdWJzdHIoaSArIDEsIDIpID09PSAnIVsnKSB7XG4gICAgICAgIGNvbnN0IGNsb3NlSW5kZXggPSBmaW5kQ2xvc2luZ0luZGV4KHhtbERhdGEsIFwiXV0+XCIsIGksIFwiU3RvcE5vZGUgaXMgbm90IGNsb3NlZC5cIikgLSAyO1xuICAgICAgICBpID0gY2xvc2VJbmRleDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IHRhZ0RhdGEgPSByZWFkVGFnRXhwKHhtbERhdGEsIGksICc+JylcblxuICAgICAgICBpZiAodGFnRGF0YSkge1xuICAgICAgICAgIGNvbnN0IG9wZW5UYWdOYW1lID0gdGFnRGF0YSAmJiB0YWdEYXRhLnRhZ05hbWU7XG4gICAgICAgICAgaWYgKG9wZW5UYWdOYW1lID09PSB0YWdOYW1lICYmIHRhZ0RhdGEudGFnRXhwW3RhZ0RhdGEudGFnRXhwLmxlbmd0aCAtIDFdICE9PSBcIi9cIikge1xuICAgICAgICAgICAgb3BlblRhZ0NvdW50Kys7XG4gICAgICAgICAgfVxuICAgICAgICAgIGkgPSB0YWdEYXRhLmNsb3NlSW5kZXg7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0vL2VuZCBmb3IgbG9vcFxufVxuXG5mdW5jdGlvbiBwYXJzZVZhbHVlKHZhbCwgc2hvdWxkUGFyc2UsIG9wdGlvbnMpIHtcbiAgaWYgKHNob3VsZFBhcnNlICYmIHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgLy9jb25zb2xlLmxvZyhvcHRpb25zKVxuICAgIGNvbnN0IG5ld3ZhbCA9IHZhbC50cmltKCk7XG4gICAgaWYgKG5ld3ZhbCA9PT0gJ3RydWUnKSByZXR1cm4gdHJ1ZTtcbiAgICBlbHNlIGlmIChuZXd2YWwgPT09ICdmYWxzZScpIHJldHVybiBmYWxzZTtcbiAgICBlbHNlIHJldHVybiB0b051bWJlcih2YWwsIG9wdGlvbnMpO1xuICB9IGVsc2Uge1xuICAgIGlmICh1dGlsLmlzRXhpc3QodmFsKSkge1xuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBmcm9tQ29kZVBvaW50KHN0ciwgYmFzZSwgcHJlZml4KSB7XG4gIGNvbnN0IGNvZGVQb2ludCA9IE51bWJlci5wYXJzZUludChzdHIsIGJhc2UpO1xuXG4gIGlmIChjb2RlUG9pbnQgPj0gMCAmJiBjb2RlUG9pbnQgPD0gMHgxMEZGRkYpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21Db2RlUG9pbnQoY29kZVBvaW50KTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcHJlZml4ICsgc3RyICsgXCI7XCI7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2FuaXRpemVOYW1lKG5hbWUsIG9wdGlvbnMpIHtcbiAgaWYgKHV0aWwuY3JpdGljYWxQcm9wZXJ0aWVzLmluY2x1ZGVzKG5hbWUpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBbU0VDVVJJVFldIEludmFsaWQgbmFtZTogXCIke25hbWV9XCIgaXMgYSByZXNlcnZlZCBKYXZhU2NyaXB0IGtleXdvcmQgdGhhdCBjb3VsZCBjYXVzZSBwcm90b3R5cGUgcG9sbHV0aW9uYCk7XG4gIH0gZWxzZSBpZiAodXRpbC5EQU5HRVJPVVNfUFJPUEVSVFlfTkFNRVMuaW5jbHVkZXMobmFtZSkpIHtcbiAgICByZXR1cm4gb3B0aW9ucy5vbkRhbmdlcm91c1Byb3BlcnR5KG5hbWUpO1xuICB9XG4gIHJldHVybiBuYW1lO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IE9yZGVyZWRPYmpQYXJzZXI7XG5cbiIsICIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogXG4gKiBAcGFyYW0ge2FycmF5fSBub2RlIFxuICogQHBhcmFtIHthbnl9IG9wdGlvbnMgXG4gKiBAcmV0dXJucyBcbiAqL1xuZnVuY3Rpb24gcHJldHRpZnkobm9kZSwgb3B0aW9ucyl7XG4gIHJldHVybiBjb21wcmVzcyggbm9kZSwgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogXG4gKiBAcGFyYW0ge2FycmF5fSBhcnIgXG4gKiBAcGFyYW0ge29iamVjdH0gb3B0aW9ucyBcbiAqIEBwYXJhbSB7c3RyaW5nfSBqUGF0aCBcbiAqIEByZXR1cm5zIG9iamVjdFxuICovXG5mdW5jdGlvbiBjb21wcmVzcyhhcnIsIG9wdGlvbnMsIGpQYXRoKXtcbiAgbGV0IHRleHQ7XG4gIGNvbnN0IGNvbXByZXNzZWRPYmogPSB7fTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCB0YWdPYmogPSBhcnJbaV07XG4gICAgY29uc3QgcHJvcGVydHkgPSBwcm9wTmFtZSh0YWdPYmopO1xuICAgIGxldCBuZXdKcGF0aCA9IFwiXCI7XG4gICAgaWYoalBhdGggPT09IHVuZGVmaW5lZCkgbmV3SnBhdGggPSBwcm9wZXJ0eTtcbiAgICBlbHNlIG5ld0pwYXRoID0galBhdGggKyBcIi5cIiArIHByb3BlcnR5O1xuXG4gICAgaWYocHJvcGVydHkgPT09IG9wdGlvbnMudGV4dE5vZGVOYW1lKXtcbiAgICAgIGlmKHRleHQgPT09IHVuZGVmaW5lZCkgdGV4dCA9IHRhZ09ialtwcm9wZXJ0eV07XG4gICAgICBlbHNlIHRleHQgKz0gXCJcIiArIHRhZ09ialtwcm9wZXJ0eV07XG4gICAgfWVsc2UgaWYocHJvcGVydHkgPT09IHVuZGVmaW5lZCl7XG4gICAgICBjb250aW51ZTtcbiAgICB9ZWxzZSBpZih0YWdPYmpbcHJvcGVydHldKXtcbiAgICAgIFxuICAgICAgbGV0IHZhbCA9IGNvbXByZXNzKHRhZ09ialtwcm9wZXJ0eV0sIG9wdGlvbnMsIG5ld0pwYXRoKTtcbiAgICAgIGNvbnN0IGlzTGVhZiA9IGlzTGVhZlRhZyh2YWwsIG9wdGlvbnMpO1xuXG4gICAgICBpZih0YWdPYmpbXCI6QFwiXSl7XG4gICAgICAgIGFzc2lnbkF0dHJpYnV0ZXMoIHZhbCwgdGFnT2JqW1wiOkBcIl0sIG5ld0pwYXRoLCBvcHRpb25zKTtcbiAgICAgIH1lbHNlIGlmKE9iamVjdC5rZXlzKHZhbCkubGVuZ3RoID09PSAxICYmIHZhbFtvcHRpb25zLnRleHROb2RlTmFtZV0gIT09IHVuZGVmaW5lZCAmJiAhb3B0aW9ucy5hbHdheXNDcmVhdGVUZXh0Tm9kZSl7XG4gICAgICAgIHZhbCA9IHZhbFtvcHRpb25zLnRleHROb2RlTmFtZV07XG4gICAgICB9ZWxzZSBpZihPYmplY3Qua2V5cyh2YWwpLmxlbmd0aCA9PT0gMCl7XG4gICAgICAgIGlmKG9wdGlvbnMuYWx3YXlzQ3JlYXRlVGV4dE5vZGUpIHZhbFtvcHRpb25zLnRleHROb2RlTmFtZV0gPSBcIlwiO1xuICAgICAgICBlbHNlIHZhbCA9IFwiXCI7XG4gICAgICB9XG5cbiAgICAgIGlmKGNvbXByZXNzZWRPYmpbcHJvcGVydHldICE9PSB1bmRlZmluZWQgJiYgY29tcHJlc3NlZE9iai5oYXNPd25Qcm9wZXJ0eShwcm9wZXJ0eSkpIHtcbiAgICAgICAgaWYoIUFycmF5LmlzQXJyYXkoY29tcHJlc3NlZE9ialtwcm9wZXJ0eV0pKSB7XG4gICAgICAgICAgICBjb21wcmVzc2VkT2JqW3Byb3BlcnR5XSA9IFsgY29tcHJlc3NlZE9ialtwcm9wZXJ0eV0gXTtcbiAgICAgICAgfVxuICAgICAgICBjb21wcmVzc2VkT2JqW3Byb3BlcnR5XS5wdXNoKHZhbCk7XG4gICAgICB9ZWxzZXtcbiAgICAgICAgLy9UT0RPOiBpZiBhIG5vZGUgaXMgbm90IGFuIGFycmF5LCB0aGVuIGNoZWNrIGlmIGl0IHNob3VsZCBiZSBhbiBhcnJheVxuICAgICAgICAvL2Fsc28gZGV0ZXJtaW5lIGlmIGl0IGlzIGEgbGVhZiBub2RlXG4gICAgICAgIGlmIChvcHRpb25zLmlzQXJyYXkocHJvcGVydHksIG5ld0pwYXRoLCBpc0xlYWYgKSkge1xuICAgICAgICAgIGNvbXByZXNzZWRPYmpbcHJvcGVydHldID0gW3ZhbF07XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgIGNvbXByZXNzZWRPYmpbcHJvcGVydHldID0gdmFsO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFxuICB9XG4gIC8vIGlmKHRleHQgJiYgdGV4dC5sZW5ndGggPiAwKSBjb21wcmVzc2VkT2JqW29wdGlvbnMudGV4dE5vZGVOYW1lXSA9IHRleHQ7XG4gIGlmKHR5cGVvZiB0ZXh0ID09PSBcInN0cmluZ1wiKXtcbiAgICBpZih0ZXh0Lmxlbmd0aCA+IDApIGNvbXByZXNzZWRPYmpbb3B0aW9ucy50ZXh0Tm9kZU5hbWVdID0gdGV4dDtcbiAgfWVsc2UgaWYodGV4dCAhPT0gdW5kZWZpbmVkKSBjb21wcmVzc2VkT2JqW29wdGlvbnMudGV4dE5vZGVOYW1lXSA9IHRleHQ7XG4gIHJldHVybiBjb21wcmVzc2VkT2JqO1xufVxuXG5mdW5jdGlvbiBwcm9wTmFtZShvYmope1xuICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMob2JqKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBrZXlzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3Qga2V5ID0ga2V5c1tpXTtcbiAgICBpZihrZXkgIT09IFwiOkBcIikgcmV0dXJuIGtleTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NpZ25BdHRyaWJ1dGVzKG9iaiwgYXR0ck1hcCwganBhdGgsIG9wdGlvbnMpe1xuICBpZiAoYXR0ck1hcCkge1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhhdHRyTWFwKTtcbiAgICBjb25zdCBsZW4gPSBrZXlzLmxlbmd0aDsgLy9kb24ndCBtYWtlIGl0IGlubGluZVxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGNvbnN0IGF0cnJOYW1lID0ga2V5c1tpXTtcbiAgICAgIGlmIChvcHRpb25zLmlzQXJyYXkoYXRyck5hbWUsIGpwYXRoICsgXCIuXCIgKyBhdHJyTmFtZSwgdHJ1ZSwgdHJ1ZSkpIHtcbiAgICAgICAgb2JqW2F0cnJOYW1lXSA9IFsgYXR0ck1hcFthdHJyTmFtZV0gXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG9ialthdHJyTmFtZV0gPSBhdHRyTWFwW2F0cnJOYW1lXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gaXNMZWFmVGFnKG9iaiwgb3B0aW9ucyl7XG4gIGNvbnN0IHsgdGV4dE5vZGVOYW1lIH0gPSBvcHRpb25zO1xuICBjb25zdCBwcm9wQ291bnQgPSBPYmplY3Qua2V5cyhvYmopLmxlbmd0aDtcbiAgXG4gIGlmIChwcm9wQ291bnQgPT09IDApIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGlmIChcbiAgICBwcm9wQ291bnQgPT09IDEgJiZcbiAgICAob2JqW3RleHROb2RlTmFtZV0gfHwgdHlwZW9mIG9ialt0ZXh0Tm9kZU5hbWVdID09PSBcImJvb2xlYW5cIiB8fCBvYmpbdGV4dE5vZGVOYW1lXSA9PT0gMClcbiAgKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59XG5leHBvcnRzLnByZXR0aWZ5ID0gcHJldHRpZnk7XG4iLCAiY29uc3QgeyBidWlsZE9wdGlvbnN9ID0gcmVxdWlyZShcIi4vT3B0aW9uc0J1aWxkZXJcIik7XG5jb25zdCBPcmRlcmVkT2JqUGFyc2VyID0gcmVxdWlyZShcIi4vT3JkZXJlZE9ialBhcnNlclwiKTtcbmNvbnN0IHsgcHJldHRpZnl9ID0gcmVxdWlyZShcIi4vbm9kZTJqc29uXCIpO1xuY29uc3QgdmFsaWRhdG9yID0gcmVxdWlyZSgnLi4vdmFsaWRhdG9yJyk7XG5cbmNsYXNzIFhNTFBhcnNlcntcbiAgICBcbiAgICBjb25zdHJ1Y3RvcihvcHRpb25zKXtcbiAgICAgICAgdGhpcy5leHRlcm5hbEVudGl0aWVzID0ge307XG4gICAgICAgIHRoaXMub3B0aW9ucyA9IGJ1aWxkT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgXG4gICAgfVxuICAgIC8qKlxuICAgICAqIFBhcnNlIFhNTCBkYXRzIHRvIEpTIG9iamVjdCBcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xCdWZmZXJ9IHhtbERhdGEgXG4gICAgICogQHBhcmFtIHtib29sZWFufE9iamVjdH0gdmFsaWRhdGlvbk9wdGlvbiBcbiAgICAgKi9cbiAgICBwYXJzZSh4bWxEYXRhLHZhbGlkYXRpb25PcHRpb24pe1xuICAgICAgICBpZih0eXBlb2YgeG1sRGF0YSA9PT0gXCJzdHJpbmdcIil7XG4gICAgICAgIH1lbHNlIGlmKCB4bWxEYXRhLnRvU3RyaW5nKXtcbiAgICAgICAgICAgIHhtbERhdGEgPSB4bWxEYXRhLnRvU3RyaW5nKCk7XG4gICAgICAgIH1lbHNle1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiWE1MIGRhdGEgaXMgYWNjZXB0ZWQgaW4gU3RyaW5nIG9yIEJ5dGVzW10gZm9ybS5cIilcbiAgICAgICAgfVxuICAgICAgICBpZiggdmFsaWRhdGlvbk9wdGlvbil7XG4gICAgICAgICAgICBpZih2YWxpZGF0aW9uT3B0aW9uID09PSB0cnVlKSB2YWxpZGF0aW9uT3B0aW9uID0ge307IC8vdmFsaWRhdGUgd2l0aCBkZWZhdWx0IG9wdGlvbnNcbiAgICAgICAgICAgIFxuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gdmFsaWRhdG9yLnZhbGlkYXRlKHhtbERhdGEsIHZhbGlkYXRpb25PcHRpb24pO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCAhPT0gdHJ1ZSkge1xuICAgICAgICAgICAgICB0aHJvdyBFcnJvciggYCR7cmVzdWx0LmVyci5tc2d9OiR7cmVzdWx0LmVyci5saW5lfToke3Jlc3VsdC5lcnIuY29sfWAgKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgY29uc3Qgb3JkZXJlZE9ialBhcnNlciA9IG5ldyBPcmRlcmVkT2JqUGFyc2VyKHRoaXMub3B0aW9ucyk7XG4gICAgICAgIG9yZGVyZWRPYmpQYXJzZXIuYWRkRXh0ZXJuYWxFbnRpdGllcyh0aGlzLmV4dGVybmFsRW50aXRpZXMpO1xuICAgICAgICBjb25zdCBvcmRlcmVkUmVzdWx0ID0gb3JkZXJlZE9ialBhcnNlci5wYXJzZVhtbCh4bWxEYXRhKTtcbiAgICAgICAgaWYodGhpcy5vcHRpb25zLnByZXNlcnZlT3JkZXIgfHwgb3JkZXJlZFJlc3VsdCA9PT0gdW5kZWZpbmVkKSByZXR1cm4gb3JkZXJlZFJlc3VsdDtcbiAgICAgICAgZWxzZSByZXR1cm4gcHJldHRpZnkob3JkZXJlZFJlc3VsdCwgdGhpcy5vcHRpb25zKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBZGQgRW50aXR5IHdoaWNoIGlzIG5vdCBieSBkZWZhdWx0IHN1cHBvcnRlZCBieSB0aGlzIGxpYnJhcnlcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5IFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWx1ZSBcbiAgICAgKi9cbiAgICBhZGRFbnRpdHkoa2V5LCB2YWx1ZSl7XG4gICAgICAgIGlmKHZhbHVlLmluZGV4T2YoXCImXCIpICE9PSAtMSl7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJFbnRpdHkgdmFsdWUgY2FuJ3QgaGF2ZSAnJidcIilcbiAgICAgICAgfWVsc2UgaWYoa2V5LmluZGV4T2YoXCImXCIpICE9PSAtMSB8fCBrZXkuaW5kZXhPZihcIjtcIikgIT09IC0xKXtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFuIGVudGl0eSBtdXN0IGJlIHNldCB3aXRob3V0ICcmJyBhbmQgJzsnLiBFZy4gdXNlICcjeEQnIGZvciAnJiN4RDsnXCIpXG4gICAgICAgIH1lbHNlIGlmKHZhbHVlID09PSBcIiZcIil7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJBbiBlbnRpdHkgd2l0aCB2YWx1ZSAnJicgaXMgbm90IHBlcm1pdHRlZFwiKTtcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB0aGlzLmV4dGVybmFsRW50aXRpZXNba2V5XSA9IHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFhNTFBhcnNlcjsiLCAiY29uc3QgRU9MID0gXCJcXG5cIjtcblxuLyoqXG4gKiBcbiAqIEBwYXJhbSB7YXJyYXl9IGpBcnJheSBcbiAqIEBwYXJhbSB7YW55fSBvcHRpb25zIFxuICogQHJldHVybnMgXG4gKi9cbmZ1bmN0aW9uIHRvWG1sKGpBcnJheSwgb3B0aW9ucykge1xuICAgIGxldCBpbmRlbnRhdGlvbiA9IFwiXCI7XG4gICAgaWYgKG9wdGlvbnMuZm9ybWF0ICYmIG9wdGlvbnMuaW5kZW50QnkubGVuZ3RoID4gMCkge1xuICAgICAgICBpbmRlbnRhdGlvbiA9IEVPTDtcbiAgICB9XG4gICAgcmV0dXJuIGFyclRvU3RyKGpBcnJheSwgb3B0aW9ucywgXCJcIiwgaW5kZW50YXRpb24pO1xufVxuXG5mdW5jdGlvbiBhcnJUb1N0cihhcnIsIG9wdGlvbnMsIGpQYXRoLCBpbmRlbnRhdGlvbikge1xuICAgIGxldCB4bWxTdHIgPSBcIlwiO1xuICAgIGxldCBpc1ByZXZpb3VzRWxlbWVudFRhZyA9IGZhbHNlO1xuXG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoYXJyKSkge1xuICAgICAgICAvLyBOb24tYXJyYXkgdmFsdWVzIChlLmcuIHN0cmluZyB0YWcgdmFsdWVzKSBzaG91bGQgYmUgdHJlYXRlZCBhcyB0ZXh0IGNvbnRlbnRcbiAgICAgICAgaWYgKGFyciAhPT0gdW5kZWZpbmVkICYmIGFyciAhPT0gbnVsbCkge1xuICAgICAgICAgICAgbGV0IHRleHQgPSBhcnIudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIHRleHQgPSByZXBsYWNlRW50aXRpZXNWYWx1ZSh0ZXh0LCBvcHRpb25zKTtcbiAgICAgICAgICAgIHJldHVybiB0ZXh0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBcIlwiO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IHRhZ09iaiA9IGFycltpXTtcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IHByb3BOYW1lKHRhZ09iaik7XG4gICAgICAgIGlmICh0YWdOYW1lID09PSB1bmRlZmluZWQpIGNvbnRpbnVlO1xuXG4gICAgICAgIGxldCBuZXdKUGF0aCA9IFwiXCI7XG4gICAgICAgIGlmIChqUGF0aC5sZW5ndGggPT09IDApIG5ld0pQYXRoID0gdGFnTmFtZVxuICAgICAgICBlbHNlIG5ld0pQYXRoID0gYCR7alBhdGh9LiR7dGFnTmFtZX1gO1xuXG4gICAgICAgIGlmICh0YWdOYW1lID09PSBvcHRpb25zLnRleHROb2RlTmFtZSkge1xuICAgICAgICAgICAgbGV0IHRhZ1RleHQgPSB0YWdPYmpbdGFnTmFtZV07XG4gICAgICAgICAgICBpZiAoIWlzU3RvcE5vZGUobmV3SlBhdGgsIG9wdGlvbnMpKSB7XG4gICAgICAgICAgICAgICAgdGFnVGV4dCA9IG9wdGlvbnMudGFnVmFsdWVQcm9jZXNzb3IodGFnTmFtZSwgdGFnVGV4dCk7XG4gICAgICAgICAgICAgICAgdGFnVGV4dCA9IHJlcGxhY2VFbnRpdGllc1ZhbHVlKHRhZ1RleHQsIG9wdGlvbnMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlzUHJldmlvdXNFbGVtZW50VGFnKSB7XG4gICAgICAgICAgICAgICAgeG1sU3RyICs9IGluZGVudGF0aW9uO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeG1sU3RyICs9IHRhZ1RleHQ7XG4gICAgICAgICAgICBpc1ByZXZpb3VzRWxlbWVudFRhZyA9IGZhbHNlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnTmFtZSA9PT0gb3B0aW9ucy5jZGF0YVByb3BOYW1lKSB7XG4gICAgICAgICAgICBpZiAoaXNQcmV2aW91c0VsZW1lbnRUYWcpIHtcbiAgICAgICAgICAgICAgICB4bWxTdHIgKz0gaW5kZW50YXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB4bWxTdHIgKz0gYDwhW0NEQVRBWyR7dGFnT2JqW3RhZ05hbWVdWzBdW29wdGlvbnMudGV4dE5vZGVOYW1lXX1dXT5gO1xuICAgICAgICAgICAgaXNQcmV2aW91c0VsZW1lbnRUYWcgPSBmYWxzZTtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKHRhZ05hbWUgPT09IG9wdGlvbnMuY29tbWVudFByb3BOYW1lKSB7XG4gICAgICAgICAgICB4bWxTdHIgKz0gaW5kZW50YXRpb24gKyBgPCEtLSR7dGFnT2JqW3RhZ05hbWVdWzBdW29wdGlvbnMudGV4dE5vZGVOYW1lXX0tLT5gO1xuICAgICAgICAgICAgaXNQcmV2aW91c0VsZW1lbnRUYWcgPSB0cnVlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnTmFtZVswXSA9PT0gXCI/XCIpIHtcbiAgICAgICAgICAgIGNvbnN0IGF0dFN0ciA9IGF0dHJfdG9fc3RyKHRhZ09ialtcIjpAXCJdLCBvcHRpb25zKTtcbiAgICAgICAgICAgIGNvbnN0IHRlbXBJbmQgPSB0YWdOYW1lID09PSBcIj94bWxcIiA/IFwiXCIgOiBpbmRlbnRhdGlvbjtcbiAgICAgICAgICAgIGxldCBwaVRleHROb2RlTmFtZSA9IHRhZ09ialt0YWdOYW1lXVswXVtvcHRpb25zLnRleHROb2RlTmFtZV07XG4gICAgICAgICAgICBwaVRleHROb2RlTmFtZSA9IHBpVGV4dE5vZGVOYW1lLmxlbmd0aCAhPT0gMCA/IFwiIFwiICsgcGlUZXh0Tm9kZU5hbWUgOiBcIlwiOyAvL3JlbW92ZSBleHRyYSBzcGFjaW5nXG4gICAgICAgICAgICB4bWxTdHIgKz0gdGVtcEluZCArIGA8JHt0YWdOYW1lfSR7cGlUZXh0Tm9kZU5hbWV9JHthdHRTdHJ9Pz5gO1xuICAgICAgICAgICAgaXNQcmV2aW91c0VsZW1lbnRUYWcgPSB0cnVlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IG5ld0lkZW50YXRpb24gPSBpbmRlbnRhdGlvbjtcbiAgICAgICAgaWYgKG5ld0lkZW50YXRpb24gIT09IFwiXCIpIHtcbiAgICAgICAgICAgIG5ld0lkZW50YXRpb24gKz0gb3B0aW9ucy5pbmRlbnRCeTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCBhdHRTdHIgPSBhdHRyX3RvX3N0cih0YWdPYmpbXCI6QFwiXSwgb3B0aW9ucyk7XG4gICAgICAgIGNvbnN0IHRhZ1N0YXJ0ID0gaW5kZW50YXRpb24gKyBgPCR7dGFnTmFtZX0ke2F0dFN0cn1gO1xuICAgICAgICBjb25zdCB0YWdWYWx1ZSA9IGFyclRvU3RyKHRhZ09ialt0YWdOYW1lXSwgb3B0aW9ucywgbmV3SlBhdGgsIG5ld0lkZW50YXRpb24pO1xuICAgICAgICBpZiAob3B0aW9ucy51bnBhaXJlZFRhZ3MuaW5kZXhPZih0YWdOYW1lKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGlmIChvcHRpb25zLnN1cHByZXNzVW5wYWlyZWROb2RlKSB4bWxTdHIgKz0gdGFnU3RhcnQgKyBcIj5cIjtcbiAgICAgICAgICAgIGVsc2UgeG1sU3RyICs9IHRhZ1N0YXJ0ICsgXCIvPlwiO1xuICAgICAgICB9IGVsc2UgaWYgKCghdGFnVmFsdWUgfHwgdGFnVmFsdWUubGVuZ3RoID09PSAwKSAmJiBvcHRpb25zLnN1cHByZXNzRW1wdHlOb2RlKSB7XG4gICAgICAgICAgICB4bWxTdHIgKz0gdGFnU3RhcnQgKyBcIi8+XCI7XG4gICAgICAgIH0gZWxzZSBpZiAodGFnVmFsdWUgJiYgdGFnVmFsdWUuZW5kc1dpdGgoXCI+XCIpKSB7XG4gICAgICAgICAgICB4bWxTdHIgKz0gdGFnU3RhcnQgKyBgPiR7dGFnVmFsdWV9JHtpbmRlbnRhdGlvbn08LyR7dGFnTmFtZX0+YDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHhtbFN0ciArPSB0YWdTdGFydCArIFwiPlwiO1xuICAgICAgICAgICAgaWYgKHRhZ1ZhbHVlICYmIGluZGVudGF0aW9uICE9PSBcIlwiICYmICh0YWdWYWx1ZS5pbmNsdWRlcyhcIi8+XCIpIHx8IHRhZ1ZhbHVlLmluY2x1ZGVzKFwiPC9cIikpKSB7XG4gICAgICAgICAgICAgICAgeG1sU3RyICs9IGluZGVudGF0aW9uICsgb3B0aW9ucy5pbmRlbnRCeSArIHRhZ1ZhbHVlICsgaW5kZW50YXRpb247XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHhtbFN0ciArPSB0YWdWYWx1ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHhtbFN0ciArPSBgPC8ke3RhZ05hbWV9PmA7XG4gICAgICAgIH1cbiAgICAgICAgaXNQcmV2aW91c0VsZW1lbnRUYWcgPSB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB4bWxTdHI7XG59XG5cbmZ1bmN0aW9uIHByb3BOYW1lKG9iaikge1xuICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBrZXkgPSBrZXlzW2ldO1xuICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIGNvbnRpbnVlO1xuICAgICAgICBpZiAoa2V5ICE9PSBcIjpAXCIpIHJldHVybiBrZXk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhdHRyX3RvX3N0cihhdHRyTWFwLCBvcHRpb25zKSB7XG4gICAgbGV0IGF0dHJTdHIgPSBcIlwiO1xuICAgIGlmIChhdHRyTWFwICYmICFvcHRpb25zLmlnbm9yZUF0dHJpYnV0ZXMpIHtcbiAgICAgICAgZm9yIChsZXQgYXR0ciBpbiBhdHRyTWFwKSB7XG4gICAgICAgICAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChhdHRyTWFwLCBhdHRyKSkgY29udGludWU7XG4gICAgICAgICAgICBsZXQgYXR0clZhbCA9IG9wdGlvbnMuYXR0cmlidXRlVmFsdWVQcm9jZXNzb3IoYXR0ciwgYXR0ck1hcFthdHRyXSk7XG4gICAgICAgICAgICBhdHRyVmFsID0gcmVwbGFjZUVudGl0aWVzVmFsdWUoYXR0clZhbCwgb3B0aW9ucyk7XG4gICAgICAgICAgICBpZiAoYXR0clZhbCA9PT0gdHJ1ZSAmJiBvcHRpb25zLnN1cHByZXNzQm9vbGVhbkF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICAgICAgICBhdHRyU3RyICs9IGAgJHthdHRyLnN1YnN0cihvcHRpb25zLmF0dHJpYnV0ZU5hbWVQcmVmaXgubGVuZ3RoKX1gO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhdHRyU3RyICs9IGAgJHthdHRyLnN1YnN0cihvcHRpb25zLmF0dHJpYnV0ZU5hbWVQcmVmaXgubGVuZ3RoKX09XCIke2F0dHJWYWx9XCJgO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhdHRyU3RyO1xufVxuXG5mdW5jdGlvbiBpc1N0b3BOb2RlKGpQYXRoLCBvcHRpb25zKSB7XG4gICAgalBhdGggPSBqUGF0aC5zdWJzdHIoMCwgalBhdGgubGVuZ3RoIC0gb3B0aW9ucy50ZXh0Tm9kZU5hbWUubGVuZ3RoIC0gMSk7XG4gICAgbGV0IHRhZ05hbWUgPSBqUGF0aC5zdWJzdHIoalBhdGgubGFzdEluZGV4T2YoXCIuXCIpICsgMSk7XG4gICAgZm9yIChsZXQgaW5kZXggaW4gb3B0aW9ucy5zdG9wTm9kZXMpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuc3RvcE5vZGVzW2luZGV4XSA9PT0galBhdGggfHwgb3B0aW9ucy5zdG9wTm9kZXNbaW5kZXhdID09PSBcIiouXCIgKyB0YWdOYW1lKSByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlRW50aXRpZXNWYWx1ZSh0ZXh0VmFsdWUsIG9wdGlvbnMpIHtcbiAgICBpZiAodGV4dFZhbHVlICYmIHRleHRWYWx1ZS5sZW5ndGggPiAwICYmIG9wdGlvbnMucHJvY2Vzc0VudGl0aWVzKSB7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgb3B0aW9ucy5lbnRpdGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgZW50aXR5ID0gb3B0aW9ucy5lbnRpdGllc1tpXTtcbiAgICAgICAgICAgIHRleHRWYWx1ZSA9IHRleHRWYWx1ZS5yZXBsYWNlKGVudGl0eS5yZWdleCwgZW50aXR5LnZhbCk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHRleHRWYWx1ZTtcbn1cbm1vZHVsZS5leHBvcnRzID0gdG9YbWw7XG4iLCAiJ3VzZSBzdHJpY3QnO1xuLy9wYXJzZSBFbXB0eSBOb2RlIGFzIHNlbGYgY2xvc2luZyBub2RlXG5jb25zdCBidWlsZEZyb21PcmRlcmVkSnMgPSByZXF1aXJlKCcuL29yZGVyZWRKczJYbWwnKTtcbmNvbnN0IGdldElnbm9yZUF0dHJpYnV0ZXNGbiA9IHJlcXVpcmUoJy4uL2lnbm9yZUF0dHJpYnV0ZXMnKVxuXG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgYXR0cmlidXRlTmFtZVByZWZpeDogJ0BfJyxcbiAgYXR0cmlidXRlc0dyb3VwTmFtZTogZmFsc2UsXG4gIHRleHROb2RlTmFtZTogJyN0ZXh0JyxcbiAgaWdub3JlQXR0cmlidXRlczogdHJ1ZSxcbiAgY2RhdGFQcm9wTmFtZTogZmFsc2UsXG4gIGZvcm1hdDogZmFsc2UsXG4gIGluZGVudEJ5OiAnICAnLFxuICBzdXBwcmVzc0VtcHR5Tm9kZTogZmFsc2UsXG4gIHN1cHByZXNzVW5wYWlyZWROb2RlOiB0cnVlLFxuICBzdXBwcmVzc0Jvb2xlYW5BdHRyaWJ1dGVzOiB0cnVlLFxuICB0YWdWYWx1ZVByb2Nlc3NvcjogZnVuY3Rpb24oa2V5LCBhKSB7XG4gICAgcmV0dXJuIGE7XG4gIH0sXG4gIGF0dHJpYnV0ZVZhbHVlUHJvY2Vzc29yOiBmdW5jdGlvbihhdHRyTmFtZSwgYSkge1xuICAgIHJldHVybiBhO1xuICB9LFxuICBwcmVzZXJ2ZU9yZGVyOiBmYWxzZSxcbiAgY29tbWVudFByb3BOYW1lOiBmYWxzZSxcbiAgdW5wYWlyZWRUYWdzOiBbXSxcbiAgZW50aXRpZXM6IFtcbiAgICB7IHJlZ2V4OiBuZXcgUmVnRXhwKFwiJlwiLCBcImdcIiksIHZhbDogXCImYW1wO1wiIH0sLy9pdCBtdXN0IGJlIG9uIHRvcFxuICAgIHsgcmVnZXg6IG5ldyBSZWdFeHAoXCI+XCIsIFwiZ1wiKSwgdmFsOiBcIiZndDtcIiB9LFxuICAgIHsgcmVnZXg6IG5ldyBSZWdFeHAoXCI8XCIsIFwiZ1wiKSwgdmFsOiBcIiZsdDtcIiB9LFxuICAgIHsgcmVnZXg6IG5ldyBSZWdFeHAoXCJcXCdcIiwgXCJnXCIpLCB2YWw6IFwiJmFwb3M7XCIgfSxcbiAgICB7IHJlZ2V4OiBuZXcgUmVnRXhwKFwiXFxcIlwiLCBcImdcIiksIHZhbDogXCImcXVvdDtcIiB9XG4gIF0sXG4gIHByb2Nlc3NFbnRpdGllczogdHJ1ZSxcbiAgc3RvcE5vZGVzOiBbXSxcbiAgLy8gdHJhbnNmb3JtVGFnTmFtZTogZmFsc2UsXG4gIC8vIHRyYW5zZm9ybUF0dHJpYnV0ZU5hbWU6IGZhbHNlLFxuICBvbmVMaXN0R3JvdXA6IGZhbHNlXG59O1xuXG5mdW5jdGlvbiBCdWlsZGVyKG9wdGlvbnMpIHtcbiAgdGhpcy5vcHRpb25zID0gT2JqZWN0LmFzc2lnbih7fSwgZGVmYXVsdE9wdGlvbnMsIG9wdGlvbnMpO1xuICBpZiAodGhpcy5vcHRpb25zLmlnbm9yZUF0dHJpYnV0ZXMgPT09IHRydWUgfHwgdGhpcy5vcHRpb25zLmF0dHJpYnV0ZXNHcm91cE5hbWUpIHtcbiAgICB0aGlzLmlzQXR0cmlidXRlID0gZnVuY3Rpb24oLyphKi8pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9O1xuICB9IGVsc2Uge1xuICAgIHRoaXMuaWdub3JlQXR0cmlidXRlc0ZuID0gZ2V0SWdub3JlQXR0cmlidXRlc0ZuKHRoaXMub3B0aW9ucy5pZ25vcmVBdHRyaWJ1dGVzKVxuICAgIHRoaXMuYXR0clByZWZpeExlbiA9IHRoaXMub3B0aW9ucy5hdHRyaWJ1dGVOYW1lUHJlZml4Lmxlbmd0aDtcbiAgICB0aGlzLmlzQXR0cmlidXRlID0gaXNBdHRyaWJ1dGU7XG4gIH1cblxuICB0aGlzLnByb2Nlc3NUZXh0T3JPYmpOb2RlID0gcHJvY2Vzc1RleHRPck9iak5vZGVcblxuICBpZiAodGhpcy5vcHRpb25zLmZvcm1hdCkge1xuICAgIHRoaXMuaW5kZW50YXRlID0gaW5kZW50YXRlO1xuICAgIHRoaXMudGFnRW5kQ2hhciA9ICc+XFxuJztcbiAgICB0aGlzLm5ld0xpbmUgPSAnXFxuJztcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmluZGVudGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH07XG4gICAgdGhpcy50YWdFbmRDaGFyID0gJz4nO1xuICAgIHRoaXMubmV3TGluZSA9ICcnO1xuICB9XG59XG5cbkJ1aWxkZXIucHJvdG90eXBlLmJ1aWxkID0gZnVuY3Rpb24oak9iaikge1xuICBpZih0aGlzLm9wdGlvbnMucHJlc2VydmVPcmRlcil7XG4gICAgcmV0dXJuIGJ1aWxkRnJvbU9yZGVyZWRKcyhqT2JqLCB0aGlzLm9wdGlvbnMpO1xuICB9ZWxzZSB7XG4gICAgaWYoQXJyYXkuaXNBcnJheShqT2JqKSAmJiB0aGlzLm9wdGlvbnMuYXJyYXlOb2RlTmFtZSAmJiB0aGlzLm9wdGlvbnMuYXJyYXlOb2RlTmFtZS5sZW5ndGggPiAxKXtcbiAgICAgIGpPYmogPSB7XG4gICAgICAgIFt0aGlzLm9wdGlvbnMuYXJyYXlOb2RlTmFtZV0gOiBqT2JqXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmoyeChqT2JqLCAwLCBbXSkudmFsO1xuICB9XG59O1xuXG5CdWlsZGVyLnByb3RvdHlwZS5qMnggPSBmdW5jdGlvbihqT2JqLCBsZXZlbCwgYWpQYXRoKSB7XG4gIGxldCBhdHRyU3RyID0gJyc7XG4gIGxldCB2YWwgPSAnJztcbiAgY29uc3QgalBhdGggPSBhalBhdGguam9pbignLicpXG4gIGZvciAobGV0IGtleSBpbiBqT2JqKSB7XG4gICAgaWYoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChqT2JqLCBrZXkpKSBjb250aW51ZTtcbiAgICBpZiAodHlwZW9mIGpPYmpba2V5XSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIC8vIHN1cHJlc3MgdW5kZWZpbmVkIG5vZGUgb25seSBpZiBpdCBpcyBub3QgYW4gYXR0cmlidXRlXG4gICAgICBpZiAodGhpcy5pc0F0dHJpYnV0ZShrZXkpKSB7XG4gICAgICAgIHZhbCArPSAnJztcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGpPYmpba2V5XSA9PT0gbnVsbCkge1xuICAgICAgLy8gbnVsbCBhdHRyaWJ1dGUgc2hvdWxkIGJlIGlnbm9yZWQgYnkgdGhlIGF0dHJpYnV0ZSBsaXN0LCBidXQgc2hvdWxkIG5vdCBjYXVzZSB0aGUgdGFnIGNsb3NpbmdcbiAgICAgIGlmICh0aGlzLmlzQXR0cmlidXRlKGtleSkpIHtcbiAgICAgICAgdmFsICs9ICcnO1xuICAgICAgfSBlbHNlIGlmIChrZXkgPT09IHRoaXMub3B0aW9ucy5jZGF0YVByb3BOYW1lKSB7XG4gICAgICAgIHZhbCArPSAnJztcbiAgICAgIH0gZWxzZSBpZiAoa2V5WzBdID09PSAnPycpIHtcbiAgICAgICAgdmFsICs9IHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArICc/JyArIHRoaXMudGFnRW5kQ2hhcjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCArPSB0aGlzLmluZGVudGF0ZShsZXZlbCkgKyAnPCcgKyBrZXkgKyAnLycgKyB0aGlzLnRhZ0VuZENoYXI7XG4gICAgICB9XG4gICAgICAvLyB2YWwgKz0gdGhpcy5pbmRlbnRhdGUobGV2ZWwpICsgJzwnICsga2V5ICsgJy8nICsgdGhpcy50YWdFbmRDaGFyO1xuICAgIH0gZWxzZSBpZiAoak9ialtrZXldIGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgdmFsICs9IHRoaXMuYnVpbGRUZXh0VmFsTm9kZShqT2JqW2tleV0sIGtleSwgJycsIGxldmVsKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBqT2JqW2tleV0gIT09ICdvYmplY3QnKSB7XG4gICAgICAvL3ByZW1pdGl2ZSB0eXBlXG4gICAgICBjb25zdCBhdHRyID0gdGhpcy5pc0F0dHJpYnV0ZShrZXkpO1xuICAgICAgaWYgKGF0dHIgJiYgIXRoaXMuaWdub3JlQXR0cmlidXRlc0ZuKGF0dHIsIGpQYXRoKSkge1xuICAgICAgICBhdHRyU3RyICs9IHRoaXMuYnVpbGRBdHRyUGFpclN0cihhdHRyLCAnJyArIGpPYmpba2V5XSk7XG4gICAgICB9IGVsc2UgaWYgKCFhdHRyKSB7XG4gICAgICAgIC8vdGFnIHZhbHVlXG4gICAgICAgIGlmIChrZXkgPT09IHRoaXMub3B0aW9ucy50ZXh0Tm9kZU5hbWUpIHtcbiAgICAgICAgICBsZXQgbmV3dmFsID0gdGhpcy5vcHRpb25zLnRhZ1ZhbHVlUHJvY2Vzc29yKGtleSwgJycgKyBqT2JqW2tleV0pO1xuICAgICAgICAgIHZhbCArPSB0aGlzLnJlcGxhY2VFbnRpdGllc1ZhbHVlKG5ld3ZhbCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdmFsICs9IHRoaXMuYnVpbGRUZXh0VmFsTm9kZShqT2JqW2tleV0sIGtleSwgJycsIGxldmVsKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShqT2JqW2tleV0pKSB7XG4gICAgICAvL3JlcGVhdGVkIG5vZGVzXG4gICAgICBjb25zdCBhcnJMZW4gPSBqT2JqW2tleV0ubGVuZ3RoO1xuICAgICAgbGV0IGxpc3RUYWdWYWwgPSBcIlwiO1xuICAgICAgbGV0IGxpc3RUYWdBdHRyID0gXCJcIjtcbiAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgYXJyTGVuOyBqKyspIHtcbiAgICAgICAgY29uc3QgaXRlbSA9IGpPYmpba2V5XVtqXTtcbiAgICAgICAgaWYgKHR5cGVvZiBpdGVtID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIC8vIHN1cHJlc3MgdW5kZWZpbmVkIG5vZGVcbiAgICAgICAgfSBlbHNlIGlmIChpdGVtID09PSBudWxsKSB7XG4gICAgICAgICAgaWYoa2V5WzBdID09PSBcIj9cIikgdmFsICs9IHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArICc/JyArIHRoaXMudGFnRW5kQ2hhcjtcbiAgICAgICAgICBlbHNlIHZhbCArPSB0aGlzLmluZGVudGF0ZShsZXZlbCkgKyAnPCcgKyBrZXkgKyAnLycgKyB0aGlzLnRhZ0VuZENoYXI7XG4gICAgICAgICAgLy8gdmFsICs9IHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArICcvJyArIHRoaXMudGFnRW5kQ2hhcjtcbiAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICBpZih0aGlzLm9wdGlvbnMub25lTGlzdEdyb3VwKXtcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuajJ4KGl0ZW0sIGxldmVsICsgMSwgYWpQYXRoLmNvbmNhdChrZXkpKTtcbiAgICAgICAgICAgIGxpc3RUYWdWYWwgKz0gcmVzdWx0LnZhbDtcbiAgICAgICAgICAgIGlmICh0aGlzLm9wdGlvbnMuYXR0cmlidXRlc0dyb3VwTmFtZSAmJiBpdGVtLmhhc093blByb3BlcnR5KHRoaXMub3B0aW9ucy5hdHRyaWJ1dGVzR3JvdXBOYW1lKSkge1xuICAgICAgICAgICAgICBsaXN0VGFnQXR0ciArPSByZXN1bHQuYXR0clN0clxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1lbHNle1xuICAgICAgICAgICAgbGlzdFRhZ1ZhbCArPSB0aGlzLnByb2Nlc3NUZXh0T3JPYmpOb2RlKGl0ZW0sIGtleSwgbGV2ZWwsIGFqUGF0aClcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5vbmVMaXN0R3JvdXApIHtcbiAgICAgICAgICAgIGxldCB0ZXh0VmFsdWUgPSB0aGlzLm9wdGlvbnMudGFnVmFsdWVQcm9jZXNzb3Ioa2V5LCBpdGVtKTtcbiAgICAgICAgICAgIHRleHRWYWx1ZSA9IHRoaXMucmVwbGFjZUVudGl0aWVzVmFsdWUodGV4dFZhbHVlKTtcbiAgICAgICAgICAgIGxpc3RUYWdWYWwgKz0gdGV4dFZhbHVlO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsaXN0VGFnVmFsICs9IHRoaXMuYnVpbGRUZXh0VmFsTm9kZShpdGVtLCBrZXksICcnLCBsZXZlbCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZih0aGlzLm9wdGlvbnMub25lTGlzdEdyb3VwKXtcbiAgICAgICAgbGlzdFRhZ1ZhbCA9IHRoaXMuYnVpbGRPYmplY3ROb2RlKGxpc3RUYWdWYWwsIGtleSwgbGlzdFRhZ0F0dHIsIGxldmVsKTtcbiAgICAgIH1cbiAgICAgIHZhbCArPSBsaXN0VGFnVmFsO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL25lc3RlZCBub2RlXG4gICAgICBpZiAodGhpcy5vcHRpb25zLmF0dHJpYnV0ZXNHcm91cE5hbWUgJiYga2V5ID09PSB0aGlzLm9wdGlvbnMuYXR0cmlidXRlc0dyb3VwTmFtZSkge1xuICAgICAgICBjb25zdCBLcyA9IE9iamVjdC5rZXlzKGpPYmpba2V5XSk7XG4gICAgICAgIGNvbnN0IEwgPSBLcy5sZW5ndGg7XG4gICAgICAgIGZvciAobGV0IGogPSAwOyBqIDwgTDsgaisrKSB7XG4gICAgICAgICAgYXR0clN0ciArPSB0aGlzLmJ1aWxkQXR0clBhaXJTdHIoS3Nbal0sICcnICsgak9ialtrZXldW0tzW2pdXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCArPSB0aGlzLnByb2Nlc3NUZXh0T3JPYmpOb2RlKGpPYmpba2V5XSwga2V5LCBsZXZlbCwgYWpQYXRoKVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4ge2F0dHJTdHI6IGF0dHJTdHIsIHZhbDogdmFsfTtcbn07XG5cbkJ1aWxkZXIucHJvdG90eXBlLmJ1aWxkQXR0clBhaXJTdHIgPSBmdW5jdGlvbihhdHRyTmFtZSwgdmFsKXtcbiAgdmFsID0gdGhpcy5vcHRpb25zLmF0dHJpYnV0ZVZhbHVlUHJvY2Vzc29yKGF0dHJOYW1lLCAnJyArIHZhbCk7XG4gIHZhbCA9IHRoaXMucmVwbGFjZUVudGl0aWVzVmFsdWUodmFsKTtcbiAgaWYgKHRoaXMub3B0aW9ucy5zdXBwcmVzc0Jvb2xlYW5BdHRyaWJ1dGVzICYmIHZhbCA9PT0gXCJ0cnVlXCIpIHtcbiAgICByZXR1cm4gJyAnICsgYXR0ck5hbWU7XG4gIH0gZWxzZSByZXR1cm4gJyAnICsgYXR0ck5hbWUgKyAnPVwiJyArIHZhbCArICdcIic7XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NUZXh0T3JPYmpOb2RlIChvYmplY3QsIGtleSwgbGV2ZWwsIGFqUGF0aCkge1xuICBjb25zdCByZXN1bHQgPSB0aGlzLmoyeChvYmplY3QsIGxldmVsICsgMSwgYWpQYXRoLmNvbmNhdChrZXkpKTtcbiAgaWYgKG9iamVjdFt0aGlzLm9wdGlvbnMudGV4dE5vZGVOYW1lXSAhPT0gdW5kZWZpbmVkICYmIE9iamVjdC5rZXlzKG9iamVjdCkubGVuZ3RoID09PSAxKSB7XG4gICAgcmV0dXJuIHRoaXMuYnVpbGRUZXh0VmFsTm9kZShvYmplY3RbdGhpcy5vcHRpb25zLnRleHROb2RlTmFtZV0sIGtleSwgcmVzdWx0LmF0dHJTdHIsIGxldmVsKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5idWlsZE9iamVjdE5vZGUocmVzdWx0LnZhbCwga2V5LCByZXN1bHQuYXR0clN0ciwgbGV2ZWwpO1xuICB9XG59XG5cbkJ1aWxkZXIucHJvdG90eXBlLmJ1aWxkT2JqZWN0Tm9kZSA9IGZ1bmN0aW9uKHZhbCwga2V5LCBhdHRyU3RyLCBsZXZlbCkge1xuICBpZih2YWwgPT09IFwiXCIpe1xuICAgIGlmKGtleVswXSA9PT0gXCI/XCIpIHJldHVybiAgdGhpcy5pbmRlbnRhdGUobGV2ZWwpICsgJzwnICsga2V5ICsgYXR0clN0cisgJz8nICsgdGhpcy50YWdFbmRDaGFyO1xuICAgIGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArIGF0dHJTdHIgKyB0aGlzLmNsb3NlVGFnKGtleSkgKyB0aGlzLnRhZ0VuZENoYXI7XG4gICAgfVxuICB9ZWxzZXtcblxuICAgIGxldCB0YWdFbmRFeHAgPSAnPC8nICsga2V5ICsgdGhpcy50YWdFbmRDaGFyO1xuICAgIGxldCBwaUNsb3NpbmdDaGFyID0gXCJcIjtcbiAgICBcbiAgICBpZihrZXlbMF0gPT09IFwiP1wiKSB7XG4gICAgICBwaUNsb3NpbmdDaGFyID0gXCI/XCI7XG4gICAgICB0YWdFbmRFeHAgPSBcIlwiO1xuICAgIH1cbiAgXG4gICAgLy8gYXR0clN0ciBpcyBhbiBlbXB0eSBzdHJpbmcgaW4gY2FzZSB0aGUgYXR0cmlidXRlIGNhbWUgYXMgdW5kZWZpbmVkIG9yIG51bGxcbiAgICBpZiAoKGF0dHJTdHIgfHwgYXR0clN0ciA9PT0gJycpICYmIHZhbC5pbmRleE9mKCc8JykgPT09IC0xKSB7XG4gICAgICByZXR1cm4gKCB0aGlzLmluZGVudGF0ZShsZXZlbCkgKyAnPCcgKyAga2V5ICsgYXR0clN0ciArIHBpQ2xvc2luZ0NoYXIgKyAnPicgKyB2YWwgKyB0YWdFbmRFeHAgKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5jb21tZW50UHJvcE5hbWUgIT09IGZhbHNlICYmIGtleSA9PT0gdGhpcy5vcHRpb25zLmNvbW1lbnRQcm9wTmFtZSAmJiBwaUNsb3NpbmdDaGFyLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuaW5kZW50YXRlKGxldmVsKSArIGA8IS0tJHt2YWx9LS0+YCArIHRoaXMubmV3TGluZTtcbiAgICB9ZWxzZSB7XG4gICAgICByZXR1cm4gKFxuICAgICAgICB0aGlzLmluZGVudGF0ZShsZXZlbCkgKyAnPCcgKyBrZXkgKyBhdHRyU3RyICsgcGlDbG9zaW5nQ2hhciArIHRoaXMudGFnRW5kQ2hhciArXG4gICAgICAgIHZhbCArXG4gICAgICAgIHRoaXMuaW5kZW50YXRlKGxldmVsKSArIHRhZ0VuZEV4cCAgICApO1xuICAgIH1cbiAgfVxufVxuXG5CdWlsZGVyLnByb3RvdHlwZS5jbG9zZVRhZyA9IGZ1bmN0aW9uKGtleSl7XG4gIGxldCBjbG9zZVRhZyA9IFwiXCI7XG4gIGlmKHRoaXMub3B0aW9ucy51bnBhaXJlZFRhZ3MuaW5kZXhPZihrZXkpICE9PSAtMSl7IC8vdW5wYWlyZWRcbiAgICBpZighdGhpcy5vcHRpb25zLnN1cHByZXNzVW5wYWlyZWROb2RlKSBjbG9zZVRhZyA9IFwiL1wiXG4gIH1lbHNlIGlmKHRoaXMub3B0aW9ucy5zdXBwcmVzc0VtcHR5Tm9kZSl7IC8vZW1wdHlcbiAgICBjbG9zZVRhZyA9IFwiL1wiO1xuICB9ZWxzZXtcbiAgICBjbG9zZVRhZyA9IGA+PC8ke2tleX1gXG4gIH1cbiAgcmV0dXJuIGNsb3NlVGFnO1xufVxuXG5mdW5jdGlvbiBidWlsZEVtcHR5T2JqTm9kZSh2YWwsIGtleSwgYXR0clN0ciwgbGV2ZWwpIHtcbiAgaWYgKHZhbCAhPT0gJycpIHtcbiAgICByZXR1cm4gdGhpcy5idWlsZE9iamVjdE5vZGUodmFsLCBrZXksIGF0dHJTdHIsIGxldmVsKTtcbiAgfSBlbHNlIHtcbiAgICBpZihrZXlbMF0gPT09IFwiP1wiKSByZXR1cm4gIHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArIGF0dHJTdHIrICc/JyArIHRoaXMudGFnRW5kQ2hhcjtcbiAgICBlbHNlIHtcbiAgICAgIHJldHVybiAgdGhpcy5pbmRlbnRhdGUobGV2ZWwpICsgJzwnICsga2V5ICsgYXR0clN0ciArICcvJyArIHRoaXMudGFnRW5kQ2hhcjtcbiAgICAgIC8vIHJldHVybiB0aGlzLmJ1aWxkVGFnU3RyKGxldmVsLGtleSwgYXR0clN0cik7XG4gICAgfVxuICB9XG59XG5cbkJ1aWxkZXIucHJvdG90eXBlLmJ1aWxkVGV4dFZhbE5vZGUgPSBmdW5jdGlvbih2YWwsIGtleSwgYXR0clN0ciwgbGV2ZWwpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy5jZGF0YVByb3BOYW1lICE9PSBmYWxzZSAmJiBrZXkgPT09IHRoaXMub3B0aW9ucy5jZGF0YVByb3BOYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5kZW50YXRlKGxldmVsKSArIGA8IVtDREFUQVske3ZhbH1dXT5gICsgIHRoaXMubmV3TGluZTtcbiAgfWVsc2UgaWYgKHRoaXMub3B0aW9ucy5jb21tZW50UHJvcE5hbWUgIT09IGZhbHNlICYmIGtleSA9PT0gdGhpcy5vcHRpb25zLmNvbW1lbnRQcm9wTmFtZSkge1xuICAgIHJldHVybiB0aGlzLmluZGVudGF0ZShsZXZlbCkgKyBgPCEtLSR7dmFsfS0tPmAgKyAgdGhpcy5uZXdMaW5lO1xuICB9ZWxzZSBpZihrZXlbMF0gPT09IFwiP1wiKSB7Ly9QSSB0YWdcbiAgICByZXR1cm4gIHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArIGF0dHJTdHIrICc/JyArIHRoaXMudGFnRW5kQ2hhcjsgXG4gIH1lbHNle1xuICAgIGxldCB0ZXh0VmFsdWUgPSB0aGlzLm9wdGlvbnMudGFnVmFsdWVQcm9jZXNzb3Ioa2V5LCB2YWwpO1xuICAgIHRleHRWYWx1ZSA9IHRoaXMucmVwbGFjZUVudGl0aWVzVmFsdWUodGV4dFZhbHVlKTtcbiAgXG4gICAgaWYoIHRleHRWYWx1ZSA9PT0gJycpe1xuICAgICAgcmV0dXJuIHRoaXMuaW5kZW50YXRlKGxldmVsKSArICc8JyArIGtleSArIGF0dHJTdHIgKyB0aGlzLmNsb3NlVGFnKGtleSkgKyB0aGlzLnRhZ0VuZENoYXI7XG4gICAgfWVsc2V7XG4gICAgICByZXR1cm4gdGhpcy5pbmRlbnRhdGUobGV2ZWwpICsgJzwnICsga2V5ICsgYXR0clN0ciArICc+JyArXG4gICAgICAgICB0ZXh0VmFsdWUgK1xuICAgICAgICAnPC8nICsga2V5ICsgdGhpcy50YWdFbmRDaGFyO1xuICAgIH1cbiAgfVxufVxuXG5CdWlsZGVyLnByb3RvdHlwZS5yZXBsYWNlRW50aXRpZXNWYWx1ZSA9IGZ1bmN0aW9uKHRleHRWYWx1ZSl7XG4gIGlmKHRleHRWYWx1ZSAmJiB0ZXh0VmFsdWUubGVuZ3RoID4gMCAmJiB0aGlzLm9wdGlvbnMucHJvY2Vzc0VudGl0aWVzKXtcbiAgICBmb3IgKGxldCBpPTA7IGk8dGhpcy5vcHRpb25zLmVudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCBlbnRpdHkgPSB0aGlzLm9wdGlvbnMuZW50aXRpZXNbaV07XG4gICAgICB0ZXh0VmFsdWUgPSB0ZXh0VmFsdWUucmVwbGFjZShlbnRpdHkucmVnZXgsIGVudGl0eS52YWwpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdGV4dFZhbHVlO1xufVxuXG5mdW5jdGlvbiBpbmRlbnRhdGUobGV2ZWwpIHtcbiAgcmV0dXJuIHRoaXMub3B0aW9ucy5pbmRlbnRCeS5yZXBlYXQobGV2ZWwpO1xufVxuXG5mdW5jdGlvbiBpc0F0dHJpYnV0ZShuYW1lIC8qLCBvcHRpb25zKi8pIHtcbiAgaWYgKG5hbWUuc3RhcnRzV2l0aCh0aGlzLm9wdGlvbnMuYXR0cmlidXRlTmFtZVByZWZpeCkgJiYgbmFtZSAhPT0gdGhpcy5vcHRpb25zLnRleHROb2RlTmFtZSkge1xuICAgIHJldHVybiBuYW1lLnN1YnN0cih0aGlzLmF0dHJQcmVmaXhMZW4pO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEJ1aWxkZXI7XG4iLCAiJ3VzZSBzdHJpY3QnO1xuXG5jb25zdCB2YWxpZGF0b3IgPSByZXF1aXJlKCcuL3ZhbGlkYXRvcicpO1xuY29uc3QgWE1MUGFyc2VyID0gcmVxdWlyZSgnLi94bWxwYXJzZXIvWE1MUGFyc2VyJyk7XG5jb25zdCBYTUxCdWlsZGVyID0gcmVxdWlyZSgnLi94bWxidWlsZGVyL2pzb24yeG1sJyk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBYTUxQYXJzZXI6IFhNTFBhcnNlcixcbiAgWE1MVmFsaWRhdG9yOiB2YWxpZGF0b3IsXG4gIFhNTEJ1aWxkZXI6IFhNTEJ1aWxkZXJcbn0iLCAiLy8gRWxlY3Ryb24gbWFpbiBwcm9jZXNzOiB3aW5kb3cgbGlmZWN5Y2xlLCBzZWN1cml0eSBwb2xpY3ksIElQQyB3aXJpbmcgZm9yXG4vLyBldmVyeSBjaGFubmVsIGluIHNyYy9zaGFyZWQvaXBjLnRzLCBhbmQgdGhlIGF1dG9tYXRlZCBzbW9rZS1zY3JlZW5zaG90XG4vLyBtb2RlLiBEYXRhIGhhbmRsZXJzIG5ldmVyIHJlamVjdCBcdTIwMTQgdGhleSB2YWxpZGF0ZSBpbnB1dHMgYW5kIGZhbGwgYmFjayB0b1xuLy8gZGV0ZXJtaW5pc3RpYyBzYW1wbGUgcGF5bG9hZHMgc28gdGhlIHJlbmRlcmVyIG5ldmVyIHNlZXMgYSByZWplY3RlZFxuLy8gcHJvbWlzZSAoYWRkVG9XYXRjaGxpc3Qgc2lnbmFscyBmYWlsdXJlIHZpYSB7IG9rOiBmYWxzZSB9IGluc3RlYWQpLlxuXG5pbXBvcnQgeyBhcHAsIEJyb3dzZXJXaW5kb3csIGlwY01haW4sIHNoZWxsIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnO1xuaW1wb3J0IHBhdGggZnJvbSAnbm9kZTpwYXRoJztcbmltcG9ydCB7IElQQyB9IGZyb20gJy4uL3NoYXJlZC9pcGMnO1xuaW1wb3J0IHR5cGUge1xuICBBZGRXYXRjaGxpc3RSZXN1bHQsXG4gIENoYXJ0UmFuZ2UsXG4gIEhvbGRpbmdzUmVzdWx0LFxuICBQaXZvdFBvaW50LFxufSBmcm9tICcuLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgQ0hBUlRfUkFOR0VTIH0gZnJvbSAnLi4vc2hhcmVkL3R5cGVzJztcbmltcG9ydCB7IGdldENoYXJ0IH0gZnJvbSAnLi9zZXJ2aWNlcy9jaGFydCc7XG5pbXBvcnQgeyBnZXRFYXJuaW5ncyB9IGZyb20gJy4vc2VydmljZXMvZWFybmluZ3MnO1xuaW1wb3J0IHsgZ2V0SG9sZGluZ3MgfSBmcm9tICcuL3NlcnZpY2VzL2hvbGRpbmdzJztcbmltcG9ydCB7IGdldE5ld3MgfSBmcm9tICcuL3NlcnZpY2VzL25ld3MnO1xuaW1wb3J0IHsgZ2V0UGl2b3ROZXdzIH0gZnJvbSAnLi9zZXJ2aWNlcy9waXZvdE5ld3MnO1xuaW1wb3J0IHsgZ2V0UXVvdGVzIH0gZnJvbSAnLi9zZXJ2aWNlcy9xdW90ZXMnO1xuaW1wb3J0IHsgc2FtcGxlQ2hhcnQsIHNhbXBsZUVhcm5pbmdzLCBzYW1wbGVOZXdzLCBzYW1wbGVRdW90ZSB9IGZyb20gJy4vc2VydmljZXMvc2FtcGxlJztcbmltcG9ydCB7IHNlYXJjaFN5bWJvbHMgfSBmcm9tICcuL3NlcnZpY2VzL3N5bWJvbHMnO1xuaW1wb3J0IHsgY2xhbXBJbnQsIGNsZWFuU3ltYm9sTGlzdCwgbm9ybWFsaXplU3ltYm9sLCB0b2RheVltZCB9IGZyb20gJy4vc2VydmljZXMvdXRpbCc7XG5pbXBvcnQge1xuICBhZGRUb1dhdGNobGlzdCxcbiAgZ2V0V2F0Y2hsaXN0LFxuICByZW1vdmVGcm9tV2F0Y2hsaXN0LFxufSBmcm9tICcuL3NlcnZpY2VzL3dhdGNobGlzdFN0b3JlJztcblxuY29uc3QgTUFYX1FVT1RFX1NZTUJPTFMgPSA2MDtcbmNvbnN0IE1BWF9ORVdTX1NZTUJPTFMgPSA0MDtcbmNvbnN0IE1BWF9FQVJOSU5HU19TWU1CT0xTID0gNjA7XG5jb25zdCBNQVhfUElWT1RTID0gMTI7XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ0xJIGZsYWdzIChzbW9rZSBtb2RlKVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmNvbnN0IGlzU21va2UgPSBwcm9jZXNzLmFyZ3YuaW5jbHVkZXMoJy0tc21va2UnKTtcbmNvbnN0IHNtb2tlTW9kYWxBcmcgPSBwcm9jZXNzLmFyZ3YuZmluZCgoYXJnKSA9PiBhcmcuc3RhcnRzV2l0aCgnLS1zbW9rZS1tb2RhbD0nKSk7XG5jb25zdCBzbW9rZU1vZGFsU3ltYm9sID0gc21va2VNb2RhbEFyZ1xuICA/IG5vcm1hbGl6ZVN5bWJvbChzbW9rZU1vZGFsQXJnLnNsaWNlKCctLXNtb2tlLW1vZGFsPScubGVuZ3RoKSlcbiAgOiBudWxsO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIElucHV0IHZhbGlkYXRpb24gaGVscGVyc1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmZ1bmN0aW9uIGNsZWFuUGl2b3RzKHJhdzogdW5rbm93bik6IFBpdm90UG9pbnRbXSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShyYXcpKSByZXR1cm4gW107XG4gIGNvbnN0IG91dDogUGl2b3RQb2ludFtdID0gW107XG4gIGZvciAoY29uc3QgZW50cnkgb2YgcmF3KSB7XG4gICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkgIT09ICdvYmplY3QnKSBjb250aW51ZTtcbiAgICBjb25zdCBwID0gZW50cnkgYXMgUGFydGlhbDxQaXZvdFBvaW50PjtcbiAgICBpZiAodHlwZW9mIHAudGltZSAhPT0gJ251bWJlcicgfHwgIU51bWJlci5pc0Zpbml0ZShwLnRpbWUpKSBjb250aW51ZTtcbiAgICBpZiAodHlwZW9mIHAucHJpY2UgIT09ICdudW1iZXInIHx8ICFOdW1iZXIuaXNGaW5pdGUocC5wcmljZSkpIGNvbnRpbnVlO1xuICAgIGlmIChwLmtpbmQgIT09ICdoaWdoJyAmJiBwLmtpbmQgIT09ICdsb3cnKSBjb250aW51ZTtcbiAgICBvdXQucHVzaCh7IHRpbWU6IHAudGltZSwgcHJpY2U6IHAucHJpY2UsIGtpbmQ6IHAua2luZCB9KTtcbiAgICBpZiAob3V0Lmxlbmd0aCA+PSBNQVhfUElWT1RTKSBicmVhaztcbiAgfVxuICByZXR1cm4gb3V0O1xufVxuXG5mdW5jdGlvbiBjbGVhblJhbmdlKHJhdzogdW5rbm93bik6IENoYXJ0UmFuZ2Uge1xuICByZXR1cm4gQ0hBUlRfUkFOR0VTLmluY2x1ZGVzKHJhdyBhcyBDaGFydFJhbmdlKSA/IChyYXcgYXMgQ2hhcnRSYW5nZSkgOiAnNm0nO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIElQQyBoYW5kbGVycyBcdTIwMTQgb25lIHBlciBjaGFubmVsLCBzaWduYXR1cmVzIG1hdGNoaW5nIFF1YW50QXBpXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gcmVnaXN0ZXJJcGNIYW5kbGVycygpOiB2b2lkIHtcbiAgaXBjTWFpbi5oYW5kbGUoSVBDLndhdGNobGlzdEdldCwgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gZ2V0V2F0Y2hsaXN0KCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZShJUEMud2F0Y2hsaXN0QWRkLCBhc3luYyAoX2UsIHJhd1N5bWJvbDogdW5rbm93bik6IFByb21pc2U8QWRkV2F0Y2hsaXN0UmVzdWx0PiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlb2YgcmF3U3ltYm9sICE9PSAnc3RyaW5nJykgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ0ludmFsaWQgc3ltYm9sJyB9O1xuICAgICAgcmV0dXJuIGF3YWl0IGFkZFRvV2F0Y2hsaXN0KHJhd1N5bWJvbCk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UsIGVycm9yOiAnQ291bGQgbm90IGFkZCBzeW1ib2wnIH07XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZShJUEMud2F0Y2hsaXN0UmVtb3ZlLCAoX2UsIHJhd1N5bWJvbDogdW5rbm93bikgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzeW1ib2wgPSBub3JtYWxpemVTeW1ib2wocmF3U3ltYm9sKTtcbiAgICAgIHJldHVybiBzeW1ib2wgPyByZW1vdmVGcm9tV2F0Y2hsaXN0KHN5bWJvbCkgOiBnZXRXYXRjaGxpc3QoKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBbXTtcbiAgICB9XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKElQQy5zeW1ib2xzU2VhcmNoLCBhc3luYyAoX2UsIHJhd1F1ZXJ5OiB1bmtub3duKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGlmICh0eXBlb2YgcmF3UXVlcnkgIT09ICdzdHJpbmcnKSByZXR1cm4gW107XG4gICAgICByZXR1cm4gYXdhaXQgc2VhcmNoU3ltYm9scyhyYXdRdWVyeSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZShJUEMucXVvdGVzR2V0LCBhc3luYyAoX2UsIHJhd1N5bWJvbHM6IHVua25vd24pID0+IHtcbiAgICBjb25zdCBzeW1ib2xzID0gY2xlYW5TeW1ib2xMaXN0KHJhd1N5bWJvbHMsIE1BWF9RVU9URV9TWU1CT0xTKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGdldFF1b3RlcyhzeW1ib2xzKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBzeW1ib2xzLm1hcCgocykgPT4gc2FtcGxlUXVvdGUocykpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXBjTWFpbi5oYW5kbGUoSVBDLmhvbGRpbmdzR2V0LCBhc3luYyAoX2UsIHJhd1N5bWJvbDogdW5rbm93bik6IFByb21pc2U8SG9sZGluZ3NSZXN1bHQ+ID0+IHtcbiAgICBjb25zdCBzeW1ib2wgPSBub3JtYWxpemVTeW1ib2wocmF3U3ltYm9sKTtcbiAgICBpZiAoIXN5bWJvbCkge1xuICAgICAgcmV0dXJuIHsgZXRmU3ltYm9sOiAnJywgYXNPZjogdG9kYXlZbWQoKSwgaG9sZGluZ3M6IFtdLCBzb3VyY2U6ICdzYW1wbGUnIH07XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgZ2V0SG9sZGluZ3Moc3ltYm9sKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiB7IGV0ZlN5bWJvbDogc3ltYm9sLCBhc09mOiB0b2RheVltZCgpLCBob2xkaW5nczogW10sIHNvdXJjZTogJ3NhbXBsZScgfTtcbiAgICB9XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKElQQy5uZXdzR2V0LCBhc3luYyAoX2UsIHJhd1N5bWJvbHM6IHVua25vd24sIHJhd0xpbWl0OiB1bmtub3duKSA9PiB7XG4gICAgY29uc3Qgc3ltYm9scyA9IGNsZWFuU3ltYm9sTGlzdChyYXdTeW1ib2xzLCBNQVhfTkVXU19TWU1CT0xTKTtcbiAgICBjb25zdCBsaW1pdFBlclN5bWJvbCA9IGNsYW1wSW50KHJhd0xpbWl0LCAxLCAyMCwgNik7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBnZXROZXdzKHN5bWJvbHMsIGxpbWl0UGVyU3ltYm9sKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBzYW1wbGVOZXdzKHN5bWJvbHMpO1xuICAgIH1cbiAgfSk7XG5cbiAgaXBjTWFpbi5oYW5kbGUoSVBDLmVhcm5pbmdzR2V0LCBhc3luYyAoX2UsIHJhd1N5bWJvbHM6IHVua25vd24pID0+IHtcbiAgICBjb25zdCBzeW1ib2xzID0gY2xlYW5TeW1ib2xMaXN0KHJhd1N5bWJvbHMsIE1BWF9FQVJOSU5HU19TWU1CT0xTKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGdldEVhcm5pbmdzKHN5bWJvbHMpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHN5bWJvbHMubWFwKChzKSA9PiBzYW1wbGVFYXJuaW5ncyhzKSk7XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZShJUEMuY2hhcnRHZXQsIGFzeW5jIChfZSwgcmF3U3ltYm9sOiB1bmtub3duLCByYXdSYW5nZTogdW5rbm93bikgPT4ge1xuICAgIGNvbnN0IHN5bWJvbCA9IG5vcm1hbGl6ZVN5bWJvbChyYXdTeW1ib2wpID8/ICdTUFknO1xuICAgIGNvbnN0IHJhbmdlID0gY2xlYW5SYW5nZShyYXdSYW5nZSk7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBnZXRDaGFydChzeW1ib2wsIHJhbmdlKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBzYW1wbGVDaGFydChzeW1ib2wsIHJhbmdlKTtcbiAgICB9XG4gIH0pO1xuXG4gIGlwY01haW4uaGFuZGxlKElQQy5waXZvdE5ld3NHZXQsIGFzeW5jIChfZSwgcmF3U3ltYm9sOiB1bmtub3duLCByYXdQaXZvdHM6IHVua25vd24pID0+IHtcbiAgICBjb25zdCBwaXZvdHMgPSBjbGVhblBpdm90cyhyYXdQaXZvdHMpO1xuICAgIGNvbnN0IHN5bWJvbCA9IG5vcm1hbGl6ZVN5bWJvbChyYXdTeW1ib2wpO1xuICAgIGlmICghc3ltYm9sKSByZXR1cm4gcGl2b3RzLm1hcCgocGl2b3QpID0+ICh7IHBpdm90LCBpdGVtczogW10gfSkpO1xuICAgIHRyeSB7XG4gICAgICByZXR1cm4gYXdhaXQgZ2V0UGl2b3ROZXdzKHN5bWJvbCwgcGl2b3RzKTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIHJldHVybiBwaXZvdHMubWFwKChwaXZvdCkgPT4gKHsgcGl2b3QsIGl0ZW1zOiBbXSB9KSk7XG4gICAgfVxuICB9KTtcblxuICBpcGNNYWluLmhhbmRsZShJUEMub3BlbkV4dGVybmFsLCBhc3luYyAoX2UsIHJhd1VybDogdW5rbm93bikgPT4ge1xuICAgIGlmICh0eXBlb2YgcmF3VXJsICE9PSAnc3RyaW5nJykgcmV0dXJuO1xuICAgIGxldCBwYXJzZWQ6IFVSTDtcbiAgICB0cnkge1xuICAgICAgcGFyc2VkID0gbmV3IFVSTChyYXdVcmwpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAocGFyc2VkLnByb3RvY29sICE9PSAnaHR0cDonICYmIHBhcnNlZC5wcm90b2NvbCAhPT0gJ2h0dHBzOicpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgc2hlbGwub3BlbkV4dGVybmFsKHBhcnNlZC50b1N0cmluZygpKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1tzaGVsbF0gb3BlbkV4dGVybmFsIGZhaWxlZDonLCBlcnIpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gU21va2UgbW9kZTogc2NyZWVuc2hvdCBhZnRlciBsb2FkLCB0aGVuIHF1aXQuIEhhcmQgdGltZW91dCBhdCA0NXMuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZnVuY3Rpb24gYXJtU21va2VNb2RlKHdpbjogQnJvd3NlcldpbmRvdyk6IHZvaWQge1xuICAvLyBTbW9rZSBydW5zIGV4ZWN1dGUgb24gYSBsaXZlIGRlc2t0b3A6IHNoaWVsZCB0aGUgd2luZG93IGZyb20gc3RyYXkgdXNlclxuICAvLyBjbGlja3Mva2V5c3Ryb2tlcyBzbyBhY2NpZGVudGFsIGlucHV0IGNhbid0IG11dGF0ZSBVSSBzdGF0ZSAoZS5nLiBvcGVuaW5nXG4gIC8vIG9yIGNsb3NpbmcgdGhlIGNoYXJ0IG1vZGFsKSBiZWZvcmUgdGhlIHNjcmVlbnNob3QgaXMgY2FwdHVyZWQuXG4gIHdpbi5zZXRJZ25vcmVNb3VzZUV2ZW50cyh0cnVlKTtcbiAgd2luLnNldEZvY3VzYWJsZShmYWxzZSk7XG5cbiAgd2luLndlYkNvbnRlbnRzLm9uKCdjb25zb2xlLW1lc3NhZ2UnLCAoX2V2ZW50LCBfbGV2ZWwsIG1lc3NhZ2UpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW3JlbmRlcmVyXSAnICsgbWVzc2FnZSk7XG4gIH0pO1xuICAvLyBTdXJmYWNlIHJlbmRlcmVyIGNyYXNoZXMvcmVsb2FkcyBpbiBzbW9rZSBsb2dzIFx1MjAxNCBhIG1pZC1ydW4gcmVsb2FkIHJlc2V0c1xuICAvLyByZW5kZXJlciBzdGF0ZSBhbmQgY2FuIGludmFsaWRhdGUgdGhlIHNjcmVlbnNob3QuXG4gIHdpbi53ZWJDb250ZW50cy5vbigncmVuZGVyLXByb2Nlc3MtZ29uZScsIChfZXZlbnQsIGRldGFpbHMpID0+IHtcbiAgICBjb25zb2xlLmVycm9yKCdbcmVuZGVyZXJdIHByb2Nlc3MgZ29uZTogJyArIGRldGFpbHMucmVhc29uKTtcbiAgfSk7XG4gIHdpbi53ZWJDb250ZW50cy5vbignZGlkLXN0YXJ0LW5hdmlnYXRpb24nLCAoX2V2ZW50LCB1cmwsIGlzSW5QbGFjZSwgaXNNYWluRnJhbWUpID0+IHtcbiAgICBpZiAoaXNNYWluRnJhbWUgJiYgIWlzSW5QbGFjZSkgY29uc29sZS5sb2coJ1tzbW9rZV0gbWFpbi1mcmFtZSBuYXZpZ2F0aW9uOiAnICsgdXJsKTtcbiAgfSk7XG5cbiAgY29uc3Qga2lsbGVyID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgY29uc29sZS5lcnJvcignU01PS0VfRkFJTCBoYXJkIHRpbWVvdXQgYWZ0ZXIgNDVzJyk7XG4gICAgYXBwLmV4aXQoMSk7XG4gIH0sIDQ1XzAwMCk7XG4gIGtpbGxlci51bnJlZigpO1xuXG4gIHdpbi53ZWJDb250ZW50cy5vbmNlKCdkaWQtZmluaXNoLWxvYWQnLCAoKSA9PiB7XG4gICAgY29uc3QgZW52RGVsYXkgPSBOdW1iZXIocHJvY2Vzcy5lbnYuUVVBTlRfU01PS0VfREVMQVlfTVMpO1xuICAgIGNvbnN0IGRlbGF5TXMgPVxuICAgICAgTnVtYmVyLmlzRmluaXRlKGVudkRlbGF5KSAmJiBlbnZEZWxheSA+IDBcbiAgICAgICAgPyBNYXRoLm1pbihlbnZEZWxheSwgNDBfMDAwKVxuICAgICAgICA6IHNtb2tlTW9kYWxTeW1ib2xcbiAgICAgICAgICA/IDE2XzAwMFxuICAgICAgICAgIDogMTNfMDAwO1xuICAgIHNldFRpbWVvdXQoYXN5bmMgKCkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgaW1hZ2UgPSBhd2FpdCB3aW4ud2ViQ29udGVudHMuY2FwdHVyZVBhZ2UoKTtcbiAgICAgICAgY29uc3Qgb3V0UGF0aCA9XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuUVVBTlRfU01PS0VfT1VUIHx8XG4gICAgICAgICAgcGF0aC5qb2luKFxuICAgICAgICAgICAgYXBwLmdldEFwcFBhdGgoKSxcbiAgICAgICAgICAgIHNtb2tlTW9kYWxTeW1ib2wgPyAnZGlzdC9zbW9rZS1tb2RhbC5wbmcnIDogJ2Rpc3Qvc21va2UucG5nJyxcbiAgICAgICAgICApO1xuICAgICAgICBmcy5ta2RpclN5bmMocGF0aC5kaXJuYW1lKG91dFBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRQYXRoLCBpbWFnZS50b1BORygpKTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGtpbGxlcik7XG4gICAgICAgIGNvbnNvbGUubG9nKCdTTU9LRV9PSyAnICsgb3V0UGF0aCk7XG4gICAgICAgIGFwcC5xdWl0KCk7XG4gICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignU01PS0VfRkFJTCcsIGVycik7XG4gICAgICAgIHByb2Nlc3MuZXhpdENvZGUgPSAxO1xuICAgICAgICBhcHAucXVpdCgpO1xuICAgICAgfVxuICAgIH0sIGRlbGF5TXMpO1xuICB9KTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBXaW5kb3cgKyBhcHAgbGlmZWN5Y2xlXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxubGV0IG1haW5XaW5kb3c6IEJyb3dzZXJXaW5kb3cgfCBudWxsID0gbnVsbDtcblxuZnVuY3Rpb24gY3JlYXRlV2luZG93KCk6IHZvaWQge1xuICBjb25zdCB3aW4gPSBuZXcgQnJvd3NlcldpbmRvdyh7XG4gICAgd2lkdGg6IDE1NjAsXG4gICAgaGVpZ2h0OiA5NDAsXG4gICAgbWluV2lkdGg6IDEyMDAsXG4gICAgbWluSGVpZ2h0OiA3NjAsXG4gICAgYmFja2dyb3VuZENvbG9yOiAnIzBhMGUxNicsXG4gICAgYXV0b0hpZGVNZW51QmFyOiB0cnVlLFxuICAgIHRpdGxlOiAnUXVhbnQnLFxuICAgIHdlYlByZWZlcmVuY2VzOiB7XG4gICAgICBwcmVsb2FkOiBwYXRoLmpvaW4oX19kaXJuYW1lLCAncHJlbG9hZC5qcycpLFxuICAgICAgY29udGV4dElzb2xhdGlvbjogdHJ1ZSxcbiAgICAgIG5vZGVJbnRlZ3JhdGlvbjogZmFsc2UsXG4gICAgICBzYW5kYm94OiB0cnVlLFxuICAgIH0sXG4gIH0pO1xuICBtYWluV2luZG93ID0gd2luO1xuICB3aW4ub24oJ2Nsb3NlZCcsICgpID0+IHtcbiAgICBpZiAobWFpbldpbmRvdyA9PT0gd2luKSBtYWluV2luZG93ID0gbnVsbDtcbiAgfSk7XG5cbiAgLy8gU2VjdXJpdHk6IG5ldmVyIG9wZW4gY2hpbGQgd2luZG93cywgbmV2ZXIgbmF2aWdhdGUgYXdheS5cbiAgd2luLndlYkNvbnRlbnRzLnNldFdpbmRvd09wZW5IYW5kbGVyKCgpID0+ICh7IGFjdGlvbjogJ2RlbnknIH0pKTtcbiAgd2luLndlYkNvbnRlbnRzLm9uKCd3aWxsLW5hdmlnYXRlJywgKGV2ZW50KSA9PiBldmVudC5wcmV2ZW50RGVmYXVsdCgpKTtcblxuICBpZiAoaXNTbW9rZSkgYXJtU21va2VNb2RlKHdpbik7XG5cbiAgY29uc3QgaW5kZXhQYXRoID0gcGF0aC5qb2luKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyL2luZGV4Lmh0bWwnKTtcbiAgaWYgKHNtb2tlTW9kYWxTeW1ib2wpIHtcbiAgICB2b2lkIHdpbi5sb2FkRmlsZShpbmRleFBhdGgsIHsgcXVlcnk6IHsgc21va2VNb2RhbDogc21va2VNb2RhbFN5bWJvbCB9IH0pO1xuICB9IGVsc2Uge1xuICAgIHZvaWQgd2luLmxvYWRGaWxlKGluZGV4UGF0aCk7XG4gIH1cbn1cblxuY29uc3QgZ290TG9jayA9IGFwcC5yZXF1ZXN0U2luZ2xlSW5zdGFuY2VMb2NrKCk7XG5pZiAoIWdvdExvY2spIHtcbiAgYXBwLnF1aXQoKTtcbn0gZWxzZSB7XG4gIGFwcC5vbignc2Vjb25kLWluc3RhbmNlJywgKCkgPT4ge1xuICAgIGlmIChtYWluV2luZG93KSB7XG4gICAgICBpZiAobWFpbldpbmRvdy5pc01pbmltaXplZCgpKSBtYWluV2luZG93LnJlc3RvcmUoKTtcbiAgICAgIG1haW5XaW5kb3cuZm9jdXMoKTtcbiAgICB9XG4gIH0pO1xuXG4gIHByb2Nlc3Mub24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIChyZWFzb24pID0+IHtcbiAgICBjb25zb2xlLmVycm9yKCdbbWFpbl0gdW5oYW5kbGVkIHJlamVjdGlvbjonLCByZWFzb24pO1xuICB9KTtcblxuICBhcHAud2hlblJlYWR5KCkudGhlbigoKSA9PiB7XG4gICAgcmVnaXN0ZXJJcGNIYW5kbGVycygpO1xuICAgIGNyZWF0ZVdpbmRvdygpO1xuXG4gICAgYXBwLm9uKCdhY3RpdmF0ZScsICgpID0+IHtcbiAgICAgIGlmIChCcm93c2VyV2luZG93LmdldEFsbFdpbmRvd3MoKS5sZW5ndGggPT09IDApIGNyZWF0ZVdpbmRvdygpO1xuICAgIH0pO1xuICB9KTtcblxuICBhcHAub24oJ3dpbmRvdy1hbGwtY2xvc2VkJywgKCkgPT4ge1xuICAgIGFwcC5xdWl0KCk7XG4gIH0pO1xufVxuIiwgIi8vIElQQyBjaGFubmVsIG5hbWVzIHNoYXJlZCBieSBtYWluIChpcGNNYWluLmhhbmRsZSkgYW5kIHByZWxvYWQgKGlwY1JlbmRlcmVyLmludm9rZSkuXG4vLyBPbmUgY2hhbm5lbCBwZXIgUXVhbnRBcGkgbWV0aG9kIFx1MjAxNCBzZWUgc3JjL3NoYXJlZC90eXBlcy50cyBmb3Igc2lnbmF0dXJlcy5cblxuZXhwb3J0IGNvbnN0IElQQyA9IHtcbiAgd2F0Y2hsaXN0R2V0OiAnd2F0Y2hsaXN0OmdldCcsXG4gIHdhdGNobGlzdEFkZDogJ3dhdGNobGlzdDphZGQnLFxuICB3YXRjaGxpc3RSZW1vdmU6ICd3YXRjaGxpc3Q6cmVtb3ZlJyxcbiAgc3ltYm9sc1NlYXJjaDogJ3N5bWJvbHM6c2VhcmNoJyxcbiAgcXVvdGVzR2V0OiAncXVvdGVzOmdldCcsXG4gIGhvbGRpbmdzR2V0OiAnaG9sZGluZ3M6Z2V0JyxcbiAgbmV3c0dldDogJ25ld3M6Z2V0JyxcbiAgZWFybmluZ3NHZXQ6ICdlYXJuaW5nczpnZXQnLFxuICBjaGFydEdldDogJ2NoYXJ0OmdldCcsXG4gIHBpdm90TmV3c0dldDogJ2NoYXJ0OnBpdm90LW5ld3MnLFxuICBvcGVuRXh0ZXJuYWw6ICdzaGVsbDpvcGVuLWV4dGVybmFsJyxcbn0gYXMgY29uc3Q7XG5cbmV4cG9ydCB0eXBlIElwY0NoYW5uZWwgPSAodHlwZW9mIElQQylba2V5b2YgdHlwZW9mIElQQ107XG4iLCAiLy8gU2hhcmVkIGNvbnRyYWN0IGJldHdlZW4gdGhlIEVsZWN0cm9uIG1haW4gcHJvY2VzcyBhbmQgdGhlIHJlbmRlcmVyLlxuLy8gVGhpcyBmaWxlIGlzIHRoZSBzaW5nbGUgc291cmNlIG9mIHRydXRoIGZvciBkYXRhIHNoYXBlcyBhbmQgdGhlXG4vLyB3aW5kb3cucXVhbnQgYnJpZGdlIEFQSS4gQnJlYWtpbmcgY2hhbmdlcyBoZXJlIHJlcXVpcmUgY29vcmRpbmF0ZWRcbi8vIHVwZGF0ZXMgdG8gc3JjL21haW4vcHJlbG9hZC50cywgdGhlIElQQyBoYW5kbGVycyBpbiBzcmMvbWFpbiwgYW5kXG4vLyBldmVyeSByZW5kZXJlciBjYWxsZXIuXG5cbmV4cG9ydCB0eXBlIEluc3RydW1lbnRUeXBlID0gJ2V0ZicgfCAnc3RvY2snO1xuXG4vKiogV2hlcmUgYSBwYXlsb2FkIGNhbWUgZnJvbS4gJ3NhbXBsZScgbWVhbnMgYnVuZGxlZC9vZmZsaW5lIGZhbGxiYWNrIGRhdGEgXHUyMDE0XG4gKiAgdGhlIFVJIG11c3Qgc3VyZmFjZSB0aGlzIHNvIHRoZSB1c2VyIGlzIG5ldmVyIG1pc2xlZCBieSBzdGFsZSBudW1iZXJzLiAqL1xuZXhwb3J0IHR5cGUgRGF0YVNvdXJjZSA9ICdsaXZlJyB8ICdzYW1wbGUnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdhdGNobGlzdEl0ZW0ge1xuICBzeW1ib2w6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBJbnN0cnVtZW50VHlwZTtcbiAgYWRkZWRBdDogc3RyaW5nOyAvLyBJU08gdGltZXN0YW1wXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3ltYm9sU3VnZ2VzdGlvbiB7XG4gIHN5bWJvbDogc3RyaW5nO1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IEluc3RydW1lbnRUeXBlO1xuICBleGNoYW5nZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBRdW90ZSB7XG4gIHN5bWJvbDogc3RyaW5nO1xuICBwcmljZTogbnVtYmVyIHwgbnVsbDtcbiAgY2hhbmdlOiBudW1iZXIgfCBudWxsOyAgICAgICAgIC8vIGFic29sdXRlIGNoYW5nZSB2cyBwcmV2aW91cyBjbG9zZVxuICBjaGFuZ2VQZXJjZW50OiBudW1iZXIgfCBudWxsOyAgLy8gLTEuMjMgbWVhbnMgLTEuMjMlXG4gIHByZXZpb3VzQ2xvc2U6IG51bWJlciB8IG51bGw7XG4gIGN1cnJlbmN5OiBzdHJpbmc7XG4gIG1hcmtldFN0YXRlPzogc3RyaW5nO1xuICB1cGRhdGVkQXQ6IHN0cmluZzsgLy8gSVNPXG4gIHNvdXJjZTogRGF0YVNvdXJjZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIb2xkaW5nIHtcbiAgc3ltYm9sOiBzdHJpbmc7XG4gIG5hbWU6IHN0cmluZztcbiAgd2VpZ2h0UGVyY2VudDogbnVtYmVyIHwgbnVsbDsgLy8gMC4uMTAwXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSG9sZGluZ3NSZXN1bHQge1xuICBldGZTeW1ib2w6IHN0cmluZztcbiAgYXNPZjogc3RyaW5nOyAgICAgICAgLy8gZGF0ZSB0aGUgaG9sZGluZ3Mgc25hcHNob3QgcmVwcmVzZW50cyAoWVlZWS1NTS1ERCBvciBZWVlZLU1NKVxuICBob2xkaW5nczogSG9sZGluZ1tdOyAvLyB1cCB0byB0b3AgMjAsIHNvcnRlZCBieSB3ZWlnaHQgZGVzY1xuICBzb3VyY2U6IERhdGFTb3VyY2U7ICAvLyAnbGl2ZScgaWYgZmV0Y2hlZCwgJ3NhbXBsZScgaWYgZnJvbSB0aGUgYnVuZGxlZCBkYXRhc2V0XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTmV3c0l0ZW0ge1xuICBpZDogc3RyaW5nOyAgICAgICAgICAgIC8vIHN0YWJsZSBpZCBmb3IgZGVkdXBlICsgUmVhY3Qga2V5c1xuICB0aXRsZTogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgc291cmNlTmFtZTogc3RyaW5nOyAgICAvLyBwdWJsaXNoZXIsIGUuZy4gXCJSZXV0ZXJzXCJcbiAgcHVibGlzaGVkQXQ6IHN0cmluZzsgICAvLyBJU09cbiAgcmVsYXRlZFN5bWJvbDogc3RyaW5nOyAvLyB0aWNrZXIgdGhpcyBhcnRpY2xlIHdhcyBmZXRjaGVkIGZvclxuICBzdW1tYXJ5Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgdHlwZSBFYXJuaW5nc1RpbWUgPSAnYm1vJyB8ICdhbWMnIHwgJ3Vua25vd24nOyAvLyBiZWZvcmUgbWFya2V0IG9wZW4gLyBhZnRlciBtYXJrZXQgY2xvc2VcblxuZXhwb3J0IGludGVyZmFjZSBFYXJuaW5nc0V2ZW50IHtcbiAgc3ltYm9sOiBzdHJpbmc7XG4gIGNvbXBhbnlOYW1lOiBzdHJpbmc7XG4gIGRhdGU6IHN0cmluZzsgICAgICAgICAgLy8gSVNPIGRhdGUsIFlZWVktTU0tRERcbiAgdGltZTogRWFybmluZ3NUaW1lO1xuICBlcHNFc3RpbWF0ZTogbnVtYmVyIHwgbnVsbDtcbiAgc291cmNlOiBEYXRhU291cmNlO1xufVxuXG5leHBvcnQgdHlwZSBDaGFydFJhbmdlID0gJzFkJyB8ICcxdycgfCAnMW0nIHwgJzZtJyB8ICcxeScgfCAnNXknIHwgJ21heCc7XG5leHBvcnQgY29uc3QgQ0hBUlRfUkFOR0VTOiBDaGFydFJhbmdlW10gPSBbJzFkJywgJzF3JywgJzFtJywgJzZtJywgJzF5JywgJzV5JywgJ21heCddO1xuXG5leHBvcnQgaW50ZXJmYWNlIENhbmRsZSB7XG4gIHRpbWU6IG51bWJlcjsgLy8gdW5peCBzZWNvbmRzLCBVVENcbiAgb3BlbjogbnVtYmVyO1xuICBoaWdoOiBudW1iZXI7XG4gIGxvdzogbnVtYmVyO1xuICBjbG9zZTogbnVtYmVyO1xuICB2b2x1bWU6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGFydERhdGEge1xuICBzeW1ib2w6IHN0cmluZztcbiAgcmFuZ2U6IENoYXJ0UmFuZ2U7XG4gIGludGVydmFsOiBzdHJpbmc7IC8vIGUuZy4gXCI1bVwiLCBcIjFkXCIsIFwiMXdrXCJcbiAgY2FuZGxlczogQ2FuZGxlW107IC8vIGFzY2VuZGluZyBieSB0aW1lLCBubyBudWxsIGNsb3Nlc1xuICBjdXJyZW5jeTogc3RyaW5nO1xuICBleGNoYW5nZU5hbWU/OiBzdHJpbmc7XG4gIHJlZ3VsYXJNYXJrZXRQcmljZT86IG51bWJlciB8IG51bGw7XG4gIHByZXZpb3VzQ2xvc2U/OiBudW1iZXIgfCBudWxsO1xuICBzb3VyY2U6IERhdGFTb3VyY2U7XG59XG5cbi8qKiBBIHNpZ25pZmljYW50IGxvY2FsIGhpZ2ggb3IgbG93IGRldGVjdGVkIGluIHRoZSBjYW5kbGUgc2VyaWVzLiAqL1xuZXhwb3J0IGludGVyZmFjZSBQaXZvdFBvaW50IHtcbiAgdGltZTogbnVtYmVyOyAgLy8gdW5peCBzZWNvbmRzIFx1MjAxNCB0aW1lIG9mIHRoZSBwaXZvdCBjYW5kbGVcbiAgcHJpY2U6IG51bWJlcjsgLy8gdGhlIGNhbmRsZSdzIGhpZ2ggZm9yICdoaWdoJyBwaXZvdHMsIGxvdyBmb3IgJ2xvdydcbiAga2luZDogJ2hpZ2gnIHwgJ2xvdyc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGl2b3ROZXdzUmVzdWx0IHtcbiAgcGl2b3Q6IFBpdm90UG9pbnQ7XG4gIGl0ZW1zOiBOZXdzSXRlbVtdOyAvLyBuZXdzIHB1Ymxpc2hlZCBuZWFyIHRoZSBwaXZvdCBkYXRlOyBtYXkgYmUgZW1wdHlcbn1cblxuZXhwb3J0IHR5cGUgQWRkV2F0Y2hsaXN0UmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyBpdGVtOiBXYXRjaGxpc3RJdGVtOyB3YXRjaGxpc3Q6IFdhdGNobGlzdEl0ZW1bXSB9XG4gIHwgeyBvazogZmFsc2U7IGVycm9yOiBzdHJpbmcgfTtcblxuLyoqIFRoZSBBUEkgZXhwb3NlZCBvbiB3aW5kb3cucXVhbnQgYnkgc3JjL21haW4vcHJlbG9hZC50cy4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUXVhbnRBcGkge1xuICBnZXRXYXRjaGxpc3QoKTogUHJvbWlzZTxXYXRjaGxpc3RJdGVtW10+O1xuICBhZGRUb1dhdGNobGlzdChzeW1ib2w6IHN0cmluZyk6IFByb21pc2U8QWRkV2F0Y2hsaXN0UmVzdWx0PjtcbiAgcmVtb3ZlRnJvbVdhdGNobGlzdChzeW1ib2w6IHN0cmluZyk6IFByb21pc2U8V2F0Y2hsaXN0SXRlbVtdPjtcbiAgc2VhcmNoU3ltYm9scyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxTeW1ib2xTdWdnZXN0aW9uW10+O1xuICBnZXRRdW90ZXMoc3ltYm9sczogc3RyaW5nW10pOiBQcm9taXNlPFF1b3RlW10+O1xuICBnZXRIb2xkaW5ncyhldGZTeW1ib2w6IHN0cmluZyk6IFByb21pc2U8SG9sZGluZ3NSZXN1bHQ+O1xuICBnZXROZXdzKHN5bWJvbHM6IHN0cmluZ1tdLCBsaW1pdFBlclN5bWJvbD86IG51bWJlcik6IFByb21pc2U8TmV3c0l0ZW1bXT47XG4gIGdldEVhcm5pbmdzKHN5bWJvbHM6IHN0cmluZ1tdKTogUHJvbWlzZTxFYXJuaW5nc0V2ZW50W10+O1xuICBnZXRDaGFydChzeW1ib2w6IHN0cmluZywgcmFuZ2U6IENoYXJ0UmFuZ2UpOiBQcm9taXNlPENoYXJ0RGF0YT47XG4gIGdldFBpdm90TmV3cyhzeW1ib2w6IHN0cmluZywgcGl2b3RzOiBQaXZvdFBvaW50W10pOiBQcm9taXNlPFBpdm90TmV3c1Jlc3VsdFtdPjtcbiAgb3BlbkV4dGVybmFsKHVybDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPjtcbn1cbiIsICIvLyBMYXp5IHJlYWRlcnMgZm9yIHRoZSBKU09OIGRhdGFzZXRzIGJ1bmRsZWQgbmV4dCB0byBtYWluLmpzLlxuLy8gVGhlIGJ1aWxkIGNvcGllcyBzcmMvbWFpbi9kYXRhIC0+IGRpc3QvbWFpbi9kYXRhLCBzbyBhdCBydW50aW1lIHRoZSBmaWxlc1xuLy8gbGl2ZSBhdCBwYXRoLmpvaW4oX19kaXJuYW1lLCAnZGF0YScsIC4uLikuIENvcnJ1cHQvbWlzc2luZyBmaWxlcyBkZWdyYWRlXG4vLyB0byBlbXB0eSBkYXRhc2V0cyBcdTIwMTQgY2FsbGVycyBtdXN0IGhhbmRsZSB0aGF0LlxuXG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUgeyBIb2xkaW5nLCBJbnN0cnVtZW50VHlwZSB9IGZyb20gJy4uLy4uL3NoYXJlZC90eXBlcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXRmQnVuZGxlRW50cnkge1xuICBuYW1lOiBzdHJpbmc7XG4gIGhvbGRpbmdzOiBIb2xkaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXRmSG9sZGluZ3NCdW5kbGUge1xuICBfbWV0YT86IHsgbm90ZT86IHN0cmluZzsgYXNPZj86IHN0cmluZyB9O1xuICBldGZzOiBSZWNvcmQ8c3RyaW5nLCBFdGZCdW5kbGVFbnRyeT47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5RW50cnkge1xuICBzeW1ib2w6IHN0cmluZztcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBJbnN0cnVtZW50VHlwZTtcbiAgZXhjaGFuZ2U/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIHJlYWRKc29uKGZpbGVOYW1lOiBzdHJpbmcpOiB1bmtub3duIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBmaWxlUGF0aCA9IHBhdGguam9pbihfX2Rpcm5hbWUsICdkYXRhJywgZmlsZU5hbWUpO1xuICAgIHJldHVybiBKU09OLnBhcnNlKGZzLnJlYWRGaWxlU3luYyhmaWxlUGF0aCwgJ3V0ZjgnKSkgYXMgdW5rbm93bjtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS5lcnJvcihgW2RhdGFdIGZhaWxlZCB0byByZWFkICR7ZmlsZU5hbWV9OmAsIGVycik7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxubGV0IGV0ZkJ1bmRsZUNhY2hlOiBFdGZIb2xkaW5nc0J1bmRsZSB8IG51bGwgPSBudWxsO1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0RXRmQnVuZGxlKCk6IEV0ZkhvbGRpbmdzQnVuZGxlIHtcbiAgaWYgKGV0ZkJ1bmRsZUNhY2hlKSByZXR1cm4gZXRmQnVuZGxlQ2FjaGU7XG4gIGNvbnN0IHJhdyA9IHJlYWRKc29uKCdldGYtaG9sZGluZ3MuanNvbicpIGFzIEV0ZkhvbGRpbmdzQnVuZGxlIHwgbnVsbDtcbiAgY29uc3QgZXRmczogUmVjb3JkPHN0cmluZywgRXRmQnVuZGxlRW50cnk+ID0ge307XG4gIGlmIChyYXcgJiYgdHlwZW9mIHJhdyA9PT0gJ29iamVjdCcgJiYgcmF3LmV0ZnMgJiYgdHlwZW9mIHJhdy5ldGZzID09PSAnb2JqZWN0Jykge1xuICAgIGZvciAoY29uc3QgW3N5bWJvbCwgZW50cnldIG9mIE9iamVjdC5lbnRyaWVzKHJhdy5ldGZzKSkge1xuICAgICAgaWYgKCFlbnRyeSB8fCB0eXBlb2YgZW50cnkubmFtZSAhPT0gJ3N0cmluZycgfHwgIUFycmF5LmlzQXJyYXkoZW50cnkuaG9sZGluZ3MpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGhvbGRpbmdzOiBIb2xkaW5nW10gPSBbXTtcbiAgICAgIGZvciAoY29uc3QgaCBvZiBlbnRyeS5ob2xkaW5ncykge1xuICAgICAgICBpZiAoIWggfHwgdHlwZW9mIGguc3ltYm9sICE9PSAnc3RyaW5nJyB8fCB0eXBlb2YgaC5uYW1lICE9PSAnc3RyaW5nJykgY29udGludWU7XG4gICAgICAgIGhvbGRpbmdzLnB1c2goe1xuICAgICAgICAgIHN5bWJvbDogaC5zeW1ib2wudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICBuYW1lOiBoLm5hbWUsXG4gICAgICAgICAgd2VpZ2h0UGVyY2VudDogdHlwZW9mIGgud2VpZ2h0UGVyY2VudCA9PT0gJ251bWJlcicgPyBoLndlaWdodFBlcmNlbnQgOiBudWxsLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGV0ZnNbc3ltYm9sLnRvVXBwZXJDYXNlKCldID0geyBuYW1lOiBlbnRyeS5uYW1lLCBob2xkaW5ncyB9O1xuICAgIH1cbiAgfVxuICBldGZCdW5kbGVDYWNoZSA9IHtcbiAgICBfbWV0YTogcmF3Py5fbWV0YSxcbiAgICBldGZzLFxuICB9O1xuICByZXR1cm4gZXRmQnVuZGxlQ2FjaGU7XG59XG5cbi8qKiBUaGUgYXNPZiBsYWJlbCBmb3IgdGhlIGJ1bmRsZWQgaG9sZGluZ3Mgc25hcHNob3QuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnVuZGxlQXNPZigpOiBzdHJpbmcge1xuICByZXR1cm4gZ2V0RXRmQnVuZGxlKCkuX21ldGE/LmFzT2YgPz8gJzIwMjYtMDYnO1xufVxuXG5sZXQgZGlyZWN0b3J5Q2FjaGU6IERpcmVjdG9yeUVudHJ5W10gfCBudWxsID0gbnVsbDtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFN5bWJvbERpcmVjdG9yeSgpOiBEaXJlY3RvcnlFbnRyeVtdIHtcbiAgaWYgKGRpcmVjdG9yeUNhY2hlKSByZXR1cm4gZGlyZWN0b3J5Q2FjaGU7XG4gIGNvbnN0IHJhdyA9IHJlYWRKc29uKCdzeW1ib2wtZGlyZWN0b3J5Lmpzb24nKSBhc1xuICAgIHwgeyBzeW1ib2xzPzogdW5rbm93biB9XG4gICAgfCBudWxsO1xuICBjb25zdCBvdXQ6IERpcmVjdG9yeUVudHJ5W10gPSBbXTtcbiAgaWYgKHJhdyAmJiBBcnJheS5pc0FycmF5KHJhdy5zeW1ib2xzKSkge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgcmF3LnN5bWJvbHMpIHtcbiAgICAgIGNvbnN0IGUgPSBlbnRyeSBhcyBQYXJ0aWFsPERpcmVjdG9yeUVudHJ5PjtcbiAgICAgIGlmIChcbiAgICAgICAgdHlwZW9mIGUuc3ltYm9sID09PSAnc3RyaW5nJyAmJlxuICAgICAgICB0eXBlb2YgZS5uYW1lID09PSAnc3RyaW5nJyAmJlxuICAgICAgICAoZS50eXBlID09PSAnZXRmJyB8fCBlLnR5cGUgPT09ICdzdG9jaycpXG4gICAgICApIHtcbiAgICAgICAgb3V0LnB1c2goe1xuICAgICAgICAgIHN5bWJvbDogZS5zeW1ib2wudG9VcHBlckNhc2UoKSxcbiAgICAgICAgICBuYW1lOiBlLm5hbWUsXG4gICAgICAgICAgdHlwZTogZS50eXBlLFxuICAgICAgICAgIGV4Y2hhbmdlOiB0eXBlb2YgZS5leGNoYW5nZSA9PT0gJ3N0cmluZycgPyBlLmV4Y2hhbmdlIDogdW5kZWZpbmVkLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZGlyZWN0b3J5Q2FjaGUgPSBvdXQ7XG4gIHJldHVybiBkaXJlY3RvcnlDYWNoZTtcbn1cblxuLyoqIEV4YWN0LXN5bWJvbCBsb29rdXAgaW4gdGhlIG9mZmxpbmUgZGlyZWN0b3J5LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpcmVjdG9yeUxvb2t1cChzeW1ib2w6IHN0cmluZyk6IERpcmVjdG9yeUVudHJ5IHwgdW5kZWZpbmVkIHtcbiAgY29uc3Qgc3ltID0gc3ltYm9sLnRvVXBwZXJDYXNlKCk7XG4gIHJldHVybiBnZXRTeW1ib2xEaXJlY3RvcnkoKS5maW5kKChlKSA9PiBlLnN5bWJvbCA9PT0gc3ltKTtcbn1cblxuLyoqIEJlc3QtZWZmb3J0IGRpc3BsYXkgbmFtZSBmb3IgYSBzeW1ib2wgZnJvbSBhbnkgYnVuZGxlZCBkYXRhc2V0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGxvb2t1cE5hbWUoc3ltYm9sOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBjb25zdCBkaXIgPSBkaXJlY3RvcnlMb29rdXAoc3ltYm9sKTtcbiAgaWYgKGRpcikgcmV0dXJuIGRpci5uYW1lO1xuICBjb25zdCBidW5kbGUgPSBnZXRFdGZCdW5kbGUoKTtcbiAgY29uc3QgZXRmID0gYnVuZGxlLmV0ZnNbc3ltYm9sLnRvVXBwZXJDYXNlKCldO1xuICBpZiAoZXRmKSByZXR1cm4gZXRmLm5hbWU7XG4gIGZvciAoY29uc3QgZW50cnkgb2YgT2JqZWN0LnZhbHVlcyhidW5kbGUuZXRmcykpIHtcbiAgICBjb25zdCBoaXQgPSBlbnRyeS5ob2xkaW5ncy5maW5kKChoKSA9PiBoLnN5bWJvbCA9PT0gc3ltYm9sLnRvVXBwZXJDYXNlKCkpO1xuICAgIGlmIChoaXQpIHJldHVybiBoaXQubmFtZTtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufVxuIiwgIi8vIFNtYWxsIHNoYXJlZCB1dGlsaXRpZXMgZm9yIHRoZSBtYWluLXByb2Nlc3Mgc2VydmljZXM6IHN5bWJvbCB2YWxpZGF0aW9uLFxuLy8gc3RhYmxlIGhhc2hpbmcsIGEgc2VlZGVkIFBSTkcgZm9yIGRldGVybWluaXN0aWMgc2FtcGxlIGRhdGEsIGNvbmN1cnJlbmN5XG4vLyBsaW1pdGluZywgYW5kIGRhdGUgaGVscGVycy5cblxuLyoqIFRpY2tlciBzeW1ib2xzIHdlIGFjY2VwdCBhbnl3aGVyZSBpbiB0aGUgYXBwICh3YXRjaGxpc3QsIElQQyBpbnB1dHMpLiAqL1xuZXhwb3J0IGNvbnN0IFNZTUJPTF9SRSA9IC9eW0EtWjAtOS5eLV17MSwxMn0kL2k7XG5cbi8qKiBOb3JtYWxpemUgYW4gdW5rbm93biB2YWx1ZSB0byBhbiB1cHBlcmNhc2UgdmFsaWRhdGVkIHN5bWJvbCwgb3IgbnVsbC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVTeW1ib2wocmF3OiB1bmtub3duKTogc3RyaW5nIHwgbnVsbCB7XG4gIGlmICh0eXBlb2YgcmF3ICE9PSAnc3RyaW5nJykgcmV0dXJuIG51bGw7XG4gIGNvbnN0IHN5bSA9IHJhdy50cmltKCkudG9VcHBlckNhc2UoKTtcbiAgcmV0dXJuIHN5bS5sZW5ndGggPiAwICYmIFNZTUJPTF9SRS50ZXN0KHN5bSkgPyBzeW0gOiBudWxsO1xufVxuXG4vKiogVmFsaWRhdGUgYW4gdW5rbm93biBJUEMgcGF5bG9hZCBpbnRvIGEgdW5pcXVlLCBib3VuZGVkIHN5bWJvbCBsaXN0LiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsZWFuU3ltYm9sTGlzdChyYXc6IHVua25vd24sIG1heDogbnVtYmVyKTogc3RyaW5nW10ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkocmF3KSkgcmV0dXJuIFtdO1xuICBjb25zdCBvdXQ6IHN0cmluZ1tdID0gW107XG4gIGZvciAoY29uc3QgZW50cnkgb2YgcmF3KSB7XG4gICAgY29uc3Qgc3ltID0gbm9ybWFsaXplU3ltYm9sKGVudHJ5KTtcbiAgICBpZiAoc3ltICYmICFvdXQuaW5jbHVkZXMoc3ltKSkge1xuICAgICAgb3V0LnB1c2goc3ltKTtcbiAgICAgIGlmIChvdXQubGVuZ3RoID49IG1heCkgYnJlYWs7XG4gICAgfVxuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbi8qKiBGTlYtMWEgMzItYml0IGhhc2ggd2l0aCBhIGNvbmZpZ3VyYWJsZSBzZWVkLiBTdGFibGUgYWNyb3NzIHJ1bnMuICovXG5leHBvcnQgZnVuY3Rpb24gZm52MWEoaW5wdXQ6IHN0cmluZywgc2VlZCA9IDB4ODExYzlkYzUpOiBudW1iZXIge1xuICBsZXQgaCA9IHNlZWQgPj4+IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgaW5wdXQubGVuZ3RoOyBpKyspIHtcbiAgICBoIF49IGlucHV0LmNoYXJDb2RlQXQoaSk7XG4gICAgaCA9IE1hdGguaW11bChoLCAweDAxMDAwMTkzKTtcbiAgfVxuICByZXR1cm4gaCA+Pj4gMDtcbn1cblxuLyoqIFN0YWJsZSBub24tbmVnYXRpdmUgaW50ZWdlciBoYXNoIG9mIGEgc3RyaW5nLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHN0YWJsZUhhc2goaW5wdXQ6IHN0cmluZyk6IG51bWJlciB7XG4gIHJldHVybiBmbnYxYShpbnB1dCk7XG59XG5cbi8qKiBTaG9ydCBzdGFibGUgaWQgc3RyaW5nIGRlcml2ZWQgZnJvbSB0d28gaGFzaCBwYXNzZXMgKGZvciBOZXdzSXRlbSBpZHMpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc2hJZChpbnB1dDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGZudjFhKGlucHV0KS50b1N0cmluZygzNikgKyBmbnYxYShpbnB1dCwgMHg5NzQ3YjI4YykudG9TdHJpbmcoMzYpO1xufVxuXG4vKiogbXVsYmVycnkzMiBQUk5HIFx1MjAxNCBkZXRlcm1pbmlzdGljIHNlcXVlbmNlIGluIFswLCAxKSBmb3IgYSBnaXZlbiBzZWVkLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG11bGJlcnJ5MzIoc2VlZDogbnVtYmVyKTogKCkgPT4gbnVtYmVyIHtcbiAgbGV0IGEgPSBzZWVkID4+PiAwO1xuICByZXR1cm4gKCkgPT4ge1xuICAgIGEgPSAoYSArIDB4NmQyYjc5ZjUpIHwgMDtcbiAgICBsZXQgdCA9IE1hdGguaW11bChhIF4gKGEgPj4+IDE1KSwgMSB8IGEpO1xuICAgIHQgPSAodCArIE1hdGguaW11bCh0IF4gKHQgPj4+IDcpLCA2MSB8IHQpKSBeIHQ7XG4gICAgcmV0dXJuICgodCBeICh0ID4+PiAxNCkpID4+PiAwKSAvIDQyOTQ5NjcyOTY7XG4gIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzbGVlcChtczogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKiogTWluaW1hbCBwcm9taXNlLWNvbmN1cnJlbmN5IGxpbWl0ZXIgKHAtbGltaXQgc3R5bGUpLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBMaW1pdChjb25jdXJyZW5jeTogbnVtYmVyKTogPFQ+KGZuOiAoKSA9PiBQcm9taXNlPFQ+KSA9PiBQcm9taXNlPFQ+IHtcbiAgbGV0IGFjdGl2ZSA9IDA7XG4gIGNvbnN0IHF1ZXVlOiBBcnJheTwoKSA9PiB2b2lkPiA9IFtdO1xuICBjb25zdCBuZXh0ID0gKCk6IHZvaWQgPT4ge1xuICAgIGFjdGl2ZS0tO1xuICAgIGNvbnN0IHJ1biA9IHF1ZXVlLnNoaWZ0KCk7XG4gICAgaWYgKHJ1bikgcnVuKCk7XG4gIH07XG4gIHJldHVybiA8VD4oZm46ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+ID0+XG4gICAgbmV3IFByb21pc2U8VD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgY29uc3QgcnVuID0gKCk6IHZvaWQgPT4ge1xuICAgICAgICBhY3RpdmUrKztcbiAgICAgICAgZm4oKS50aGVuKFxuICAgICAgICAgICh2YWx1ZSkgPT4ge1xuICAgICAgICAgICAgbmV4dCgpO1xuICAgICAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICAoZXJyOiB1bmtub3duKSA9PiB7XG4gICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICByZWplY3QoZXJyKTtcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuICAgICAgfTtcbiAgICAgIGlmIChhY3RpdmUgPCBjb25jdXJyZW5jeSkgcnVuKCk7XG4gICAgICBlbHNlIHF1ZXVlLnB1c2gocnVuKTtcbiAgICB9KTtcbn1cblxuLyoqIEZvcm1hdCBhIERhdGUgYXMgVVRDIFlZWVktTU0tREQuICovXG5leHBvcnQgZnVuY3Rpb24gdG9ZbWQoZDogRGF0ZSk6IHN0cmluZyB7XG4gIHJldHVybiBkLnRvSVNPU3RyaW5nKCkuc2xpY2UoMCwgMTApO1xufVxuXG4vKiogVG9kYXkncyBkYXRlIGFzIFVUQyBZWVlZLU1NLURELiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvZGF5WW1kKCk6IHN0cmluZyB7XG4gIHJldHVybiB0b1ltZChuZXcgRGF0ZSgpKTtcbn1cblxuLyoqIFBhcnNlIGFueSBkYXRlLWlzaCBzdHJpbmcgdG8gZXBvY2ggbXMsIG9yIG51bGwgd2hlbiB1bnBhcnNlYWJsZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURhdGVNcyh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogbnVtYmVyIHwgbnVsbCB7XG4gIGlmICghdmFsdWUpIHJldHVybiBudWxsO1xuICBjb25zdCBtcyA9IERhdGUucGFyc2UodmFsdWUpO1xuICByZXR1cm4gTnVtYmVyLmlzTmFOKG1zKSA/IG51bGwgOiBtcztcbn1cblxuLyoqIE5vcm1hbGl6ZWQgZm9ybSBvZiBhIGhlYWRsaW5lIHVzZWQgZm9yIGNyb3NzLXNvdXJjZSBkZWR1cGUuICovXG5leHBvcnQgZnVuY3Rpb24gbm9ybWFsaXplVGl0bGUodGl0bGU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB0aXRsZS50b0xvd2VyQ2FzZSgpLnJlcGxhY2UoL1teYS16MC05XSsvZywgJyAnKS50cmltKCk7XG59XG5cbi8qKiBTdHJpcCBIVE1MIHRhZ3MgYW5kIGNvbGxhcHNlIHdoaXRlc3BhY2UgKGZvciBSU1MgZGVzY3JpcHRpb25zKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcEh0bWwoaW5wdXQ6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBpbnB1dFxuICAgIC5yZXBsYWNlKC88W14+XSo+L2csICcgJylcbiAgICAucmVwbGFjZSgvJmFtcDsvZywgJyYnKVxuICAgIC5yZXBsYWNlKC8mbHQ7L2csICc8JylcbiAgICAucmVwbGFjZSgvJmd0Oy9nLCAnPicpXG4gICAgLnJlcGxhY2UoLyZxdW90Oy9nLCAnXCInKVxuICAgIC5yZXBsYWNlKC8mIzA/Mzk7fCZhcG9zOy9nLCBcIidcIilcbiAgICAucmVwbGFjZSgvJm5ic3A7L2csICcgJylcbiAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgLnRyaW0oKTtcbn1cblxuLyoqIENsYW1wIGFuIHVua25vd24gbnVtZXJpYyBpbnB1dCB0byBhbiBpbnRlZ2VyIHdpdGhpbiBbbWluLCBtYXhdLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsYW1wSW50KHJhdzogdW5rbm93biwgbWluOiBudW1iZXIsIG1heDogbnVtYmVyLCBmYWxsYmFjazogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgbiA9IHR5cGVvZiByYXcgPT09ICdudW1iZXInICYmIE51bWJlci5pc0Zpbml0ZShyYXcpID8gTWF0aC5yb3VuZChyYXcpIDogZmFsbGJhY2s7XG4gIHJldHVybiBNYXRoLm1pbihtYXgsIE1hdGgubWF4KG1pbiwgbikpO1xufVxuXG4vKiogUm91bmQgdG8gMiBkZWNpbWFsIHBsYWNlcyAocHJpY2VzKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiByb3VuZDIobjogbnVtYmVyKTogbnVtYmVyIHtcbiAgcmV0dXJuIE1hdGgucm91bmQobiAqIDEwMCkgLyAxMDA7XG59XG4iLCAiLy8gRGV0ZXJtaW5pc3RpYyBvZmZsaW5lIGZhbGxiYWNrcy4gRXZlcnl0aGluZyBoZXJlIGlzIGdlbmVyYXRlZCBmcm9tIGFcbi8vIG11bGJlcnJ5MzIgUFJORyBzZWVkZWQgYnkgYSBzdGFibGUgaGFzaCBvZiBzeW1ib2woK3JhbmdlKSBcdTIwMTQgbm9cbi8vIE1hdGgucmFuZG9tLCBubyBkYXRlLXNlZWRlZCByYW5kb21uZXNzIFx1MjAxNCBzbyByZXBlYXRlZCBjYWxscyBwcm9kdWNlIHRoZVxuLy8gc2FtZSBkYXRhLiBBbGwgcGF5bG9hZHMgYXJlIGZsYWdnZWQgc291cmNlOiAnc2FtcGxlJyB3aGVyZSB0aGUgc2hhcGVcbi8vIGFsbG93cyBpdDsgc2FtcGxlIG5ld3MgaXMgbWFya2VkIHZpYSBzb3VyY2VOYW1lICdTYW1wbGUgRGF0YScgYW5kIGFcbi8vICdzYW1wbGUtJyBpZCBwcmVmaXggc2luY2UgTmV3c0l0ZW0gaGFzIG5vIHNvdXJjZSBmaWVsZC5cblxuaW1wb3J0IHR5cGUge1xuICBDYW5kbGUsXG4gIENoYXJ0RGF0YSxcbiAgQ2hhcnRSYW5nZSxcbiAgRWFybmluZ3NFdmVudCxcbiAgTmV3c0l0ZW0sXG4gIFF1b3RlLFxufSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgbG9va3VwTmFtZSB9IGZyb20gJy4vZGF0YUZpbGVzJztcbmltcG9ydCB7IG11bGJlcnJ5MzIsIHJvdW5kMiwgc3RhYmxlSGFzaCwgdG9ZbWQgfSBmcm9tICcuL3V0aWwnO1xuXG4vLyBQbGF1c2libGUgbWlkLTIwMjYgcHJpY2UgbGV2ZWxzIGZvciB3ZWxsLWtub3duIHRpY2tlcnM7IGRlZmF1bHQgMTAwLlxuY29uc3QgQkFTRV9QUklDRVM6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gIFNQWTogNjIwLCBWT086IDU3MCwgSVZWOiA2MjMsIFZUSTogMzA1LCBRUVE6IDU2MCwgRElBOiA0NDUsIElXTTogMjI1LFxuICBYTEs6IDI2NSwgWExGOiA1MywgWExFOiA5MiwgWExWOiAxMzUsIFNNSDogMjkwLCBTT1hYOiAyNDUsIEFSS0s6IDc1LFxuICBTQ0hEOiAyNywgSkVQSTogNTYsIFZHVDogNzAwLCBWVUc6IDQ2MCwgVlRWOiAxNzUsIFJTUDogMTg1LFxuICBBQVBMOiAyMzAsIE1TRlQ6IDUwMCwgTlZEQTogMTcwLCBBTVpOOiAyMjAsIEdPT0dMOiAxODUsIEdPT0c6IDE4NyxcbiAgTUVUQTogNzIwLCBUU0xBOiAzMjAsIEFWR086IDI3MCwgJ0JSSy1CJzogNDkwLCBKUE06IDI5MCwgVjogMzU1LFxuICBNQTogNTYwLCBVTkg6IDMxMCwgWE9NOiAxMTUsIExMWTogNzgwLCBKTko6IDE1NSwgUEc6IDE2MCwgSEQ6IDM2NSxcbiAgQ09TVDogOTg1LCBXTVQ6IDk4LCBORkxYOiAxMjUwLCBDUk06IDI3MCwgT1JDTDogMjEwLCBBTUQ6IDE0MCxcbiAgQURCRTogMzkwLCBQRVA6IDEzMiwgS086IDcwLCBDU0NPOiA2NiwgSU5UQzogMjIsIFRTTTogMjMwLCBBU01MOiA3OTAsXG4gIFFDT006IDE1NSwgVFhOOiAxOTUsIE1VOiAxMjAsIEFNQVQ6IDE4NSwgTFJDWDogOTUsIEtMQUM6IDg4MCxcbiAgUExUUjogMTQwLCBDT0lOOiAzNTAsIEhPT0Q6IDgwLCBTSE9QOiAxMTAsIERJUzogMTIwLCBCQTogMjEwLFxuICBDQVQ6IDM5MCwgR1M6IDcwMCwgTVM6IDE0MCwgQkFDOiA0NywgV0ZDOiA4MCwgSUJNOiAyOTAsIEdFOiAyNTAsXG4gIE1DRDogMzAwLCBOS0U6IDcyLCBUOiAyOCwgVlo6IDQzLCBQRkU6IDI1LCBNUks6IDgyLCBBQkJWOiAxOTAsXG4gIFRNTzogNDkwLCBDVlg6IDE1NSwgQ09QOiA5NSwgVUJFUjogOTAsIE5PVzogMTAwMCwgSVNSRzogNTMwLCBJTlRVOiA3NjAsXG4gIEFNR046IDI5MCwgSE9OOiAyMjAsIEdJTEQ6IDExMCwgQk1ZOiA1NSwgU0JVWDogOTUsIFBZUEw6IDc1LFxufTtcblxuZXhwb3J0IGZ1bmN0aW9uIGJhc2VQcmljZUZvcihzeW1ib2w6IHN0cmluZyk6IG51bWJlciB7XG4gIHJldHVybiBCQVNFX1BSSUNFU1tzeW1ib2wudG9VcHBlckNhc2UoKV0gPz8gMTAwO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIENhbmRsZXNcbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG50eXBlIFNlc3Npb25LaW5kID0gJ2ludHJhZGF5JyB8ICdkYWlseScgfCAnd2Vla2x5JyB8ICdtb250aGx5JztcblxuaW50ZXJmYWNlIFNhbXBsZVJhbmdlU3BlYyB7XG4gIGludGVydmFsOiBzdHJpbmc7XG4gIGNvdW50OiBudW1iZXI7XG4gIGtpbmQ6IFNlc3Npb25LaW5kO1xuICBzdGVwU2VjOiBudW1iZXI7IC8vIGJhciBzcGFjaW5nIGZvciBpbnRyYWRheSBraW5kc1xuICB2b2w6IG51bWJlcjsgICAgIC8vIHBlci1iYXIgdm9sYXRpbGl0eSAoZnJhY3Rpb25hbClcbiAgYmFzZVZvbHVtZTogbnVtYmVyO1xufVxuXG5jb25zdCBTQU1QTEVfUkFOR0U6IFJlY29yZDxDaGFydFJhbmdlLCBTYW1wbGVSYW5nZVNwZWM+ID0ge1xuICAnMWQnOiB7IGludGVydmFsOiAnNW0nLCBjb3VudDogNzgsIGtpbmQ6ICdpbnRyYWRheScsIHN0ZXBTZWM6IDMwMCwgdm9sOiAwLjAwMTIsIGJhc2VWb2x1bWU6IDkwMF8wMDAgfSxcbiAgJzF3JzogeyBpbnRlcnZhbDogJzE1bScsIGNvdW50OiAxMzAsIGtpbmQ6ICdpbnRyYWRheScsIHN0ZXBTZWM6IDkwMCwgdm9sOiAwLjAwMiwgYmFzZVZvbHVtZTogMl82MDBfMDAwIH0sXG4gICcxbSc6IHsgaW50ZXJ2YWw6ICc2MG0nLCBjb3VudDogMTU0LCBraW5kOiAnaW50cmFkYXknLCBzdGVwU2VjOiAzNjAwLCB2b2w6IDAuMDA0LCBiYXNlVm9sdW1lOiA5XzAwMF8wMDAgfSxcbiAgJzZtJzogeyBpbnRlcnZhbDogJzFkJywgY291bnQ6IDEyNiwga2luZDogJ2RhaWx5Jywgc3RlcFNlYzogODZfNDAwLCB2b2w6IDAuMDEyLCBiYXNlVm9sdW1lOiA1NV8wMDBfMDAwIH0sXG4gICcxeSc6IHsgaW50ZXJ2YWw6ICcxZCcsIGNvdW50OiAyNTIsIGtpbmQ6ICdkYWlseScsIHN0ZXBTZWM6IDg2XzQwMCwgdm9sOiAwLjAxMiwgYmFzZVZvbHVtZTogNTVfMDAwXzAwMCB9LFxuICAnNXknOiB7IGludGVydmFsOiAnMXdrJywgY291bnQ6IDI2MCwga2luZDogJ3dlZWtseScsIHN0ZXBTZWM6IDcgKiA4Nl80MDAsIHZvbDogMC4wMjgsIGJhc2VWb2x1bWU6IDI2MF8wMDBfMDAwIH0sXG4gIG1heDogeyBpbnRlcnZhbDogJzFtbycsIGNvdW50OiAyNDAsIGtpbmQ6ICdtb250aGx5Jywgc3RlcFNlYzogMzAgKiA4Nl80MDAsIHZvbDogMC4wNSwgYmFzZVZvbHVtZTogMV8xMDBfMDAwXzAwMCB9LFxufTtcblxuY29uc3QgU0VTU0lPTl9PUEVOX1NFQyA9IDEzLjUgKiAzNjAwOyAvLyAxMzozMCBVVEMgfiBVUyBtYXJrZXQgb3BlblxuY29uc3QgU0VTU0lPTl9DTE9TRV9TRUMgPSAyMCAqIDM2MDA7ICAvLyAyMDowMCBVVEMgfiBVUyBtYXJrZXQgY2xvc2VcblxuLyoqIE1vc3QgcmVjZW50IHdlZWtkYXkgKFVUQyBtaWRuaWdodCBlcG9jaCBzZWNvbmRzKSBvbi9iZWZvcmUgdGhlIGdpdmVuIGRheS4gKi9cbmZ1bmN0aW9uIGxhc3RXZWVrZGF5VXRjKGZyb21NczogbnVtYmVyKTogbnVtYmVyIHtcbiAgY29uc3QgZCA9IG5ldyBEYXRlKGZyb21Ncyk7XG4gIGQuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gIHdoaWxlIChkLmdldFVUQ0RheSgpID09PSAwIHx8IGQuZ2V0VVRDRGF5KCkgPT09IDYpIHtcbiAgICBkLnNldFVUQ0RhdGUoZC5nZXRVVENEYXRlKCkgLSAxKTtcbiAgfVxuICByZXR1cm4gTWF0aC5mbG9vcihkLmdldFRpbWUoKSAvIDEwMDApO1xufVxuXG4vKiogQnVpbGQgYXNjZW5kaW5nIGJhciB0aW1lc3RhbXBzIGVuZGluZyBuZWFyIFwibm93XCIgZm9yIHRoZSBnaXZlbiBzcGVjLiAqL1xuZnVuY3Rpb24gYnVpbGRUaW1lcyhzcGVjOiBTYW1wbGVSYW5nZVNwZWMsIGNvdW50OiBudW1iZXIpOiBudW1iZXJbXSB7XG4gIGNvbnN0IHRpbWVzOiBudW1iZXJbXSA9IFtdO1xuICBpZiAoc3BlYy5raW5kID09PSAnaW50cmFkYXknKSB7XG4gICAgbGV0IGRheSA9IGxhc3RXZWVrZGF5VXRjKERhdGUubm93KCkpO1xuICAgIHdoaWxlICh0aW1lcy5sZW5ndGggPCBjb3VudCkge1xuICAgICAgY29uc3QgZGF5QmFyczogbnVtYmVyW10gPSBbXTtcbiAgICAgIGZvciAobGV0IHQgPSBTRVNTSU9OX09QRU5fU0VDOyB0IDwgU0VTU0lPTl9DTE9TRV9TRUM7IHQgKz0gc3BlYy5zdGVwU2VjKSB7XG4gICAgICAgIGRheUJhcnMucHVzaChkYXkgKyB0KTtcbiAgICAgIH1cbiAgICAgIHRpbWVzLnVuc2hpZnQoLi4uZGF5QmFycyk7XG4gICAgICAvLyBzdGVwIGJhY2sgdG8gdGhlIHByZXZpb3VzIHdlZWtkYXlcbiAgICAgIGRheSA9IGxhc3RXZWVrZGF5VXRjKChkYXkgLSA4Nl80MDApICogMTAwMCk7XG4gICAgfVxuICAgIHJldHVybiB0aW1lcy5zbGljZSh0aW1lcy5sZW5ndGggLSBjb3VudCk7XG4gIH1cbiAgaWYgKHNwZWMua2luZCA9PT0gJ2RhaWx5Jykge1xuICAgIGxldCBkYXkgPSBsYXN0V2Vla2RheVV0YyhEYXRlLm5vdygpKTtcbiAgICB3aGlsZSAodGltZXMubGVuZ3RoIDwgY291bnQpIHtcbiAgICAgIHRpbWVzLnVuc2hpZnQoZGF5ICsgU0VTU0lPTl9PUEVOX1NFQyk7XG4gICAgICBkYXkgPSBsYXN0V2Vla2RheVV0YygoZGF5IC0gODZfNDAwKSAqIDEwMDApO1xuICAgIH1cbiAgICByZXR1cm4gdGltZXM7XG4gIH1cbiAgaWYgKHNwZWMua2luZCA9PT0gJ3dlZWtseScpIHtcbiAgICBjb25zdCBhbmNob3IgPSBsYXN0V2Vla2RheVV0YyhEYXRlLm5vdygpKTtcbiAgICBmb3IgKGxldCBpID0gY291bnQgLSAxOyBpID49IDA7IGktLSkge1xuICAgICAgdGltZXMucHVzaChhbmNob3IgLSBpICogNyAqIDg2XzQwMCArIFNFU1NJT05fT1BFTl9TRUMpO1xuICAgIH1cbiAgICByZXR1cm4gdGltZXM7XG4gIH1cbiAgLy8gbW9udGhseTogZmlyc3Qtb2YtbW9udGggc3RlcHNcbiAgY29uc3QgZCA9IG5ldyBEYXRlKCk7XG4gIGQuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7XG4gIGQuc2V0VVRDRGF0ZSgxKTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgdGltZXMudW5zaGlmdChNYXRoLmZsb29yKGQuZ2V0VGltZSgpIC8gMTAwMCkgKyBTRVNTSU9OX09QRU5fU0VDKTtcbiAgICBkLnNldFVUQ01vbnRoKGQuZ2V0VVRDTW9udGgoKSAtIDEpO1xuICB9XG4gIHJldHVybiB0aW1lcztcbn1cblxuLyoqIERldGVybWluaXN0aWMgcmFuZG9tLXdhbGsgY2FuZGxlcyBmb3IgYSBzeW1ib2wrcmFuZ2UuICovXG5leHBvcnQgZnVuY3Rpb24gc2FtcGxlQ2hhcnQoc3ltYm9sOiBzdHJpbmcsIHJhbmdlOiBDaGFydFJhbmdlKTogQ2hhcnREYXRhIHtcbiAgY29uc3Qgc3ltID0gc3ltYm9sLnRvVXBwZXJDYXNlKCk7XG4gIGNvbnN0IHNwZWMgPSBTQU1QTEVfUkFOR0VbcmFuZ2VdO1xuICBjb25zdCBybmcgPSBtdWxiZXJyeTMyKHN0YWJsZUhhc2goYCR7c3ltfXwke3JhbmdlfWApKTtcbiAgY29uc3QgYmFzZSA9IGJhc2VQcmljZUZvcihzeW0pO1xuICBjb25zdCB0aW1lcyA9IGJ1aWxkVGltZXMoc3BlYywgc3BlYy5jb3VudCk7XG4gIGNvbnN0IG4gPSB0aW1lcy5sZW5ndGg7XG5cbiAgLy8gUmFuZG9tIHdhbGsgYW5jaG9yZWQgc28gdGhlIGZpbmFsIGNsb3NlIGxhbmRzIG9uIHRoZSBiYXNlIHByaWNlLlxuICBjb25zdCBjbG9zZXMgPSBuZXcgQXJyYXk8bnVtYmVyPihuKTtcbiAgY2xvc2VzW24gLSAxXSA9IGJhc2U7XG4gIGZvciAobGV0IGkgPSBuIC0gMjsgaSA+PSAwOyBpLS0pIHtcbiAgICBjb25zdCBkcmlmdCA9IChybmcoKSAtIDAuNDk1KSAqIDIgKiBzcGVjLnZvbDtcbiAgICBjbG9zZXNbaV0gPSBjbG9zZXNbaSArIDFdIC8gKDEgKyBkcmlmdCk7XG4gIH1cblxuICBjb25zdCBjYW5kbGVzOiBDYW5kbGVbXSA9IFtdO1xuICBsZXQgcHJldkNsb3NlID0gY2xvc2VzWzBdICogKDEgKyAocm5nKCkgLSAwLjUpICogc3BlYy52b2wpO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IG47IGkrKykge1xuICAgIGNvbnN0IG9wZW4gPSBwcmV2Q2xvc2U7XG4gICAgY29uc3QgY2xvc2UgPSBjbG9zZXNbaV07XG4gICAgY29uc3Qgd2ljayA9IE1hdGgubWF4KE1hdGguYWJzKGNsb3NlIC0gb3BlbiksIGNsb3NlICogc3BlYy52b2wgKiAwLjUpO1xuICAgIGNvbnN0IGhpZ2ggPSBNYXRoLm1heChvcGVuLCBjbG9zZSkgKyBybmcoKSAqIHdpY2sgKiAwLjY7XG4gICAgY29uc3QgbG93ID0gTWF0aC5taW4ob3BlbiwgY2xvc2UpIC0gcm5nKCkgKiB3aWNrICogMC42O1xuICAgIGNhbmRsZXMucHVzaCh7XG4gICAgICB0aW1lOiB0aW1lc1tpXSxcbiAgICAgIG9wZW46IHJvdW5kMihvcGVuKSxcbiAgICAgIGhpZ2g6IHJvdW5kMihoaWdoKSxcbiAgICAgIGxvdzogcm91bmQyKE1hdGgubWF4KGxvdywgMC4wMSkpLFxuICAgICAgY2xvc2U6IHJvdW5kMihjbG9zZSksXG4gICAgICB2b2x1bWU6IE1hdGgucm91bmQoc3BlYy5iYXNlVm9sdW1lICogKDAuNCArIHJuZygpICogMS4yKSksXG4gICAgfSk7XG4gICAgcHJldkNsb3NlID0gY2xvc2U7XG4gIH1cblxuICBjb25zdCBwcmV2aW91c0Nsb3NlID1cbiAgICByYW5nZSA9PT0gJzFkJyA/IHJvdW5kMihjYW5kbGVzWzBdLm9wZW4pIDogcm91bmQyKGNhbmRsZXNbTWF0aC5tYXgoMCwgbiAtIDIpXS5jbG9zZSk7XG5cbiAgcmV0dXJuIHtcbiAgICBzeW1ib2w6IHN5bSxcbiAgICByYW5nZSxcbiAgICBpbnRlcnZhbDogc3BlYy5pbnRlcnZhbCxcbiAgICBjYW5kbGVzLFxuICAgIGN1cnJlbmN5OiAnVVNEJyxcbiAgICBleGNoYW5nZU5hbWU6IHVuZGVmaW5lZCxcbiAgICByZWd1bGFyTWFya2V0UHJpY2U6IHJvdW5kMihjYW5kbGVzW24gLSAxXS5jbG9zZSksXG4gICAgcHJldmlvdXNDbG9zZSxcbiAgICBzb3VyY2U6ICdzYW1wbGUnLFxuICB9O1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFF1b3Rlc1xuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmV4cG9ydCBmdW5jdGlvbiBzYW1wbGVRdW90ZShzeW1ib2w6IHN0cmluZyk6IFF1b3RlIHtcbiAgY29uc3Qgc3ltID0gc3ltYm9sLnRvVXBwZXJDYXNlKCk7XG4gIGNvbnN0IGNoYXJ0ID0gc2FtcGxlQ2hhcnQoc3ltLCAnMWQnKTtcbiAgY29uc3QgbGFzdCA9IGNoYXJ0LmNhbmRsZXNbY2hhcnQuY2FuZGxlcy5sZW5ndGggLSAxXTtcbiAgY29uc3QgcHJpY2UgPSBsYXN0LmNsb3NlO1xuICBjb25zdCBwcmV2aW91c0Nsb3NlID0gY2hhcnQucHJldmlvdXNDbG9zZSA/PyBudWxsO1xuICBjb25zdCBjaGFuZ2UgPVxuICAgIHByZXZpb3VzQ2xvc2UgIT09IG51bGwgPyByb3VuZDIocHJpY2UgLSBwcmV2aW91c0Nsb3NlKSA6IG51bGw7XG4gIGNvbnN0IGNoYW5nZVBlcmNlbnQgPVxuICAgIHByZXZpb3VzQ2xvc2UgIT09IG51bGwgJiYgcHJldmlvdXNDbG9zZSAhPT0gMCAmJiBjaGFuZ2UgIT09IG51bGxcbiAgICAgID8gcm91bmQyKChjaGFuZ2UgLyBwcmV2aW91c0Nsb3NlKSAqIDEwMClcbiAgICAgIDogbnVsbDtcbiAgcmV0dXJuIHtcbiAgICBzeW1ib2w6IHN5bSxcbiAgICBwcmljZSxcbiAgICBjaGFuZ2UsXG4gICAgY2hhbmdlUGVyY2VudCxcbiAgICBwcmV2aW91c0Nsb3NlLFxuICAgIGN1cnJlbmN5OiAnVVNEJyxcbiAgICB1cGRhdGVkQXQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcbiAgICBzb3VyY2U6ICdzYW1wbGUnLFxuICB9O1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIE5ld3Ncbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXG5jb25zdCBORVdTX1RFTVBMQVRFUzogQXJyYXk8KG5hbWU6IHN0cmluZywgc3ltOiBzdHJpbmcpID0+IHN0cmluZz4gPSBbXG4gIChuYW1lKSA9PiBgJHtuYW1lfSBpbiBmb2N1cyBhcyBpbnZlc3RvcnMgd2VpZ2ggdGhlIHNlY3RvciBvdXRsb29rYCxcbiAgKG5hbWUsIHN5bSkgPT4gYEFuYWx5c3RzIHJldmlzaXQgJHtuYW1lfSAoJHtzeW19KSBwcmljZSB0YXJnZXRzIGFmdGVyIHJlY2VudCBtb3Zlc2AsXG4gIChuYW1lLCBzeW0pID0+IGBXaGF0IHRoZSBsYXRlc3QgbWFya2V0IHN3aW5ncyBtZWFuIGZvciAke3N5bX0gaG9sZGVyc2AsXG4gIChuYW1lKSA9PiBgJHtuYW1lfTogdGhyZWUgdGhpbmdzIHRvIHdhdGNoIHRoaXMgcXVhcnRlcmAsXG5dO1xuXG4vKiogRGV0ZXJtaW5pc3RpYyBwbGFjZWhvbGRlciBuZXdzIGZvciB0aGUgZ2l2ZW4gc3ltYm9scyAob2ZmbGluZSBtb2RlKS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzYW1wbGVOZXdzKHN5bWJvbHM6IHN0cmluZ1tdLCBwZXJTeW1ib2wgPSAzKTogTmV3c0l0ZW1bXSB7XG4gIGNvbnN0IGl0ZW1zOiBOZXdzSXRlbVtdID0gW107XG4gIGNvbnN0IG5vd0hvdXIgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAzXzYwMF8wMDApICogM182MDBfMDAwO1xuICBmb3IgKGNvbnN0IHN5bWJvbCBvZiBzeW1ib2xzLnNsaWNlKDAsIDEyKSkge1xuICAgIGNvbnN0IHN5bSA9IHN5bWJvbC50b1VwcGVyQ2FzZSgpO1xuICAgIGNvbnN0IHJuZyA9IG11bGJlcnJ5MzIoc3RhYmxlSGFzaChgbmV3c3wke3N5bX1gKSk7XG4gICAgY29uc3QgbmFtZSA9IGxvb2t1cE5hbWUoc3ltKSA/PyBzeW07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbihwZXJTeW1ib2wsIE5FV1NfVEVNUExBVEVTLmxlbmd0aCk7IGkrKykge1xuICAgICAgY29uc3QgYWdlSG91cnMgPSAyICsgTWF0aC5mbG9vcihybmcoKSAqIDIwKSArIGkgKiAyNDtcbiAgICAgIGl0ZW1zLnB1c2goe1xuICAgICAgICBpZDogYHNhbXBsZS0ke3N5bS50b0xvd2VyQ2FzZSgpfS0ke2l9YCxcbiAgICAgICAgdGl0bGU6IE5FV1NfVEVNUExBVEVTW2ldKG5hbWUsIHN5bSksXG4gICAgICAgIHVybDogYGh0dHBzOi8vZmluYW5jZS55YWhvby5jb20vcXVvdGUvJHtlbmNvZGVVUklDb21wb25lbnQoc3ltKX1gLFxuICAgICAgICBzb3VyY2VOYW1lOiAnU2FtcGxlIERhdGEnLFxuICAgICAgICBwdWJsaXNoZWRBdDogbmV3IERhdGUobm93SG91ciAtIGFnZUhvdXJzICogM182MDBfMDAwKS50b0lTT1N0cmluZygpLFxuICAgICAgICByZWxhdGVkU3ltYm9sOiBzeW0sXG4gICAgICAgIHN1bW1hcnk6XG4gICAgICAgICAgJ09mZmxpbmUgc2FtcGxlIGhlYWRsaW5lIFx1MjAxNCBsaXZlIG5ld3Mgd2FzIHVuYXZhaWxhYmxlIHdoZW4gdGhpcyB3YXMgZ2VuZXJhdGVkLicsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgaXRlbXMuc29ydCgoYSwgYikgPT4gYi5wdWJsaXNoZWRBdC5sb2NhbGVDb21wYXJlKGEucHVibGlzaGVkQXQpKTtcbiAgcmV0dXJuIGl0ZW1zO1xufVxuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIEVhcm5pbmdzXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbXBsZUVhcm5pbmdzKHN5bWJvbDogc3RyaW5nKTogRWFybmluZ3NFdmVudCB7XG4gIGNvbnN0IHN5bSA9IHN5bWJvbC50b1VwcGVyQ2FzZSgpO1xuICBjb25zdCBoYXNoID0gc3RhYmxlSGFzaChzeW0pO1xuICBjb25zdCBkYXlzT3V0ID0gKGhhc2ggJSAyOCkgKyAyO1xuICBjb25zdCBkYXRlID0gbmV3IERhdGUoKTtcbiAgZGF0ZS5zZXRVVENIb3VycygwLCAwLCAwLCAwKTtcbiAgZGF0ZS5zZXRVVENEYXRlKGRhdGUuZ2V0VVRDRGF0ZSgpICsgZGF5c091dCk7XG4gIHJldHVybiB7XG4gICAgc3ltYm9sOiBzeW0sXG4gICAgY29tcGFueU5hbWU6IGxvb2t1cE5hbWUoc3ltKSA/PyBzeW0sXG4gICAgZGF0ZTogdG9ZbWQoZGF0ZSksXG4gICAgdGltZTogaGFzaCAlIDIgPT09IDAgPyAnYm1vJyA6ICdhbWMnLFxuICAgIGVwc0VzdGltYXRlOiBudWxsLFxuICAgIHNvdXJjZTogJ3NhbXBsZScsXG4gIH07XG59XG4iLCAiLy8gVGlueSBpbi1tZW1vcnkgVFRMIGNhY2hlLiBVc2VkIGJ5IGh0dHAudHMgKGtleWVkIGJ5IFVSTCkgYW5kIGJ5IHNlcnZpY2VzXG4vLyB0aGF0IGNhY2hlIGRlcml2ZWQgcmVzdWx0cyAoaG9sZGluZ3MsIGVhcm5pbmdzKSBrZXllZCBieSBzeW1ib2wuXG4vLyBGYWlsdXJlcyBhcmUgbmV2ZXIgc3RvcmVkIGhlcmUgXHUyMDE0IGNhbGxlcnMgb25seSBzZXQoKSBvbiBzdWNjZXNzLlxuXG5pbnRlcmZhY2UgRW50cnk8Vj4ge1xuICBleHBpcmVzOiBudW1iZXI7IC8vIGVwb2NoIG1zXG4gIHZhbHVlOiBWO1xufVxuXG5leHBvcnQgY2xhc3MgVHRsQ2FjaGU8Vj4ge1xuICBwcml2YXRlIHJlYWRvbmx5IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBFbnRyeTxWPj4oKTtcblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IG1heEVudHJpZXMgPSA4MDApIHt9XG5cbiAgZ2V0KGtleTogc3RyaW5nKTogViB8IHVuZGVmaW5lZCB7XG4gICAgY29uc3QgZW50cnkgPSB0aGlzLm1hcC5nZXQoa2V5KTtcbiAgICBpZiAoIWVudHJ5KSByZXR1cm4gdW5kZWZpbmVkO1xuICAgIGlmIChlbnRyeS5leHBpcmVzIDw9IERhdGUubm93KCkpIHtcbiAgICAgIHRoaXMubWFwLmRlbGV0ZShrZXkpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIGVudHJ5LnZhbHVlO1xuICB9XG5cbiAgc2V0KGtleTogc3RyaW5nLCB2YWx1ZTogViwgdHRsTXM6IG51bWJlcik6IHZvaWQge1xuICAgIGlmICh0dGxNcyA8PSAwKSByZXR1cm47XG4gICAgaWYgKHRoaXMubWFwLnNpemUgPj0gdGhpcy5tYXhFbnRyaWVzKSB0aGlzLnBydW5lKCk7XG4gICAgdGhpcy5tYXAuc2V0KGtleSwgeyBleHBpcmVzOiBEYXRlLm5vdygpICsgdHRsTXMsIHZhbHVlIH0pO1xuICB9XG5cbiAgZGVsZXRlKGtleTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5tYXAuZGVsZXRlKGtleSk7XG4gIH1cblxuICBwcml2YXRlIHBydW5lKCk6IHZvaWQge1xuICAgIGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG4gICAgZm9yIChjb25zdCBba2V5LCBlbnRyeV0gb2YgdGhpcy5tYXApIHtcbiAgICAgIGlmIChlbnRyeS5leHBpcmVzIDw9IG5vdykgdGhpcy5tYXAuZGVsZXRlKGtleSk7XG4gICAgfVxuICAgIC8vIFN0aWxsIG92ZXIgYnVkZ2V0IChub3RoaW5nIGV4cGlyZWQpPyBEcm9wIG9sZGVzdC1pbnNlcnRlZCBlbnRyaWVzLlxuICAgIHdoaWxlICh0aGlzLm1hcC5zaXplID49IHRoaXMubWF4RW50cmllcykge1xuICAgICAgY29uc3Qgb2xkZXN0ID0gdGhpcy5tYXAua2V5cygpLm5leHQoKTtcbiAgICAgIGlmIChvbGRlc3QuZG9uZSkgYnJlYWs7XG4gICAgICB0aGlzLm1hcC5kZWxldGUob2xkZXN0LnZhbHVlKTtcbiAgICB9XG4gIH1cbn1cbiIsICIvLyBIVFRQIGxheWVyIHVzZWQgYnkgZXZlcnkgZGF0YSBzZXJ2aWNlLlxuLy8gIC0gQnJvd3NlciBVc2VyLUFnZW50IG9uIGFsbCByZXF1ZXN0cyAoWWFob28gNDI5cyB3aXRob3V0IGl0KS5cbi8vICAtIDEycyB0aW1lb3V0IHZpYSBBYm9ydFNpZ25hbC50aW1lb3V0LlxuLy8gIC0gVXAgdG8gMiByZXRyaWVzIHdpdGggYmFja29mZjsgNHh4IChleGNlcHQgNDI5KSBpcyBub3QgcmV0cmllZC5cbi8vICAtIFBlci1ob3N0IGNvbmN1cnJlbmN5IGxpbWl0ZXI6IG1heCA0IGluIGZsaWdodCBwZXIgaG9zdCwgYW5kIH4yNTBtc1xuLy8gICAgc3BhY2luZyBiZXR3ZWVuIHJlcXVlc3Qgc3RhcnRzIGZvciBxdWVyeTEuZmluYW5jZS55YWhvby5jb20uXG4vLyAgLSBJbi1tZW1vcnkgVFRMIGNhY2hlIGtleWVkIGJ5IFVSTCAoY2FsbGVyIGRlY2lkZXMgdGhlIFRUTCkuXG4vLyAgICBGYWlsdXJlcyBhcmUgTkVWRVIgY2FjaGVkLiBJZGVudGljYWwgaW4tZmxpZ2h0IEdFVHMgYXJlIGNvYWxlc2NlZC5cblxuaW1wb3J0IHsgVHRsQ2FjaGUgfSBmcm9tICcuL2NhY2hlJztcbmltcG9ydCB7IHNsZWVwIH0gZnJvbSAnLi91dGlsJztcblxuZXhwb3J0IGNvbnN0IEJST1dTRVJfVUEgPVxuICAnTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgMTAuMDsgV2luNjQ7IHg2NCkgQXBwbGVXZWJLaXQvNTM3LjM2IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzEyNi4wLjAuMCBTYWZhcmkvNTM3LjM2JztcblxuZXhwb3J0IGNsYXNzIEh0dHBFcnJvciBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgbWVzc2FnZTogc3RyaW5nLFxuICAgIHB1YmxpYyByZWFkb25seSBzdGF0dXM/OiBudW1iZXIsXG4gICkge1xuICAgIHN1cGVyKG1lc3NhZ2UpO1xuICAgIHRoaXMubmFtZSA9ICdIdHRwRXJyb3InO1xuICB9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRmV0Y2hPcHRpb25zIHtcbiAgLyoqIENhY2hlIFRUTCBpbiBtczsgMCAoZGVmYXVsdCkgZGlzYWJsZXMgY2FjaGluZyBmb3IgdGhpcyBjYWxsLiAqL1xuICB0dGxNcz86IG51bWJlcjtcbiAgLyoqIFBlci1hdHRlbXB0IHRpbWVvdXQgaW4gbXMuICovXG4gIHRpbWVvdXRNcz86IG51bWJlcjtcbiAgLyoqIEV4dHJhIGhlYWRlcnMgbWVyZ2VkIG92ZXIgdGhlIGRlZmF1bHQgVXNlci1BZ2VudC4gKi9cbiAgaGVhZGVycz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG59XG5cbmNvbnN0IERFRkFVTFRfVElNRU9VVF9NUyA9IDEyXzAwMDtcbmNvbnN0IE1BWF9BVFRFTVBUUyA9IDM7IC8vIDEgaW5pdGlhbCArIDIgcmV0cmllc1xuY29uc3QgUkVUUllfREVMQVlTX01TID0gWzUwMCwgMTQwMF07XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gUGVyLWhvc3QgbGltaXRlclxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmNsYXNzIEhvc3RMaW1pdGVyIHtcbiAgcHJpdmF0ZSBhY3RpdmUgPSAwO1xuICBwcml2YXRlIG5leHRTbG90ID0gMDtcbiAgcHJpdmF0ZSByZWFkb25seSB3YWl0aW5nOiBBcnJheTwoKSA9PiB2b2lkPiA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgbWF4Q29uY3VycmVudDogbnVtYmVyLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgc3BhY2luZ01zOiBudW1iZXIsXG4gICkge31cblxuICBhc3luYyBydW48VD4oZm46ICgpID0+IFByb21pc2U8VD4pOiBQcm9taXNlPFQ+IHtcbiAgICBhd2FpdCB0aGlzLmFjcXVpcmUoKTtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIGF3YWl0IGZuKCk7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHRoaXMucmVsZWFzZSgpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgYWNxdWlyZSgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHtcbiAgICAgIGNvbnN0IGF0dGVtcHQgPSAoKTogdm9pZCA9PiB7XG4gICAgICAgIGlmICh0aGlzLmFjdGl2ZSA+PSB0aGlzLm1heENvbmN1cnJlbnQpIHtcbiAgICAgICAgICB0aGlzLndhaXRpbmcucHVzaChhdHRlbXB0KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcbiAgICAgICAgY29uc3Qgd2FpdCA9IHRoaXMubmV4dFNsb3QgLSBub3c7XG4gICAgICAgIGlmICh3YWl0ID4gMCkge1xuICAgICAgICAgIHNldFRpbWVvdXQoYXR0ZW1wdCwgd2FpdCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuYWN0aXZlKys7XG4gICAgICAgIHRoaXMubmV4dFNsb3QgPSBub3cgKyB0aGlzLnNwYWNpbmdNcztcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfTtcbiAgICAgIGF0dGVtcHQoKTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVsZWFzZSgpOiB2b2lkIHtcbiAgICB0aGlzLmFjdGl2ZS0tO1xuICAgIGNvbnN0IG5leHQgPSB0aGlzLndhaXRpbmcuc2hpZnQoKTtcbiAgICBpZiAobmV4dCkgbmV4dCgpO1xuICB9XG59XG5cbmNvbnN0IGxpbWl0ZXJzID0gbmV3IE1hcDxzdHJpbmcsIEhvc3RMaW1pdGVyPigpO1xuXG5mdW5jdGlvbiBsaW1pdGVyRm9yKGhvc3Q6IHN0cmluZyk6IEhvc3RMaW1pdGVyIHtcbiAgbGV0IGxpbWl0ZXIgPSBsaW1pdGVycy5nZXQoaG9zdCk7XG4gIGlmICghbGltaXRlcikge1xuICAgIGNvbnN0IHNwYWNpbmcgPSBob3N0ID09PSAncXVlcnkxLmZpbmFuY2UueWFob28uY29tJyA/IDI1MCA6IDA7XG4gICAgbGltaXRlciA9IG5ldyBIb3N0TGltaXRlcig0LCBzcGFjaW5nKTtcbiAgICBsaW1pdGVycy5zZXQoaG9zdCwgbGltaXRlcik7XG4gIH1cbiAgcmV0dXJuIGxpbWl0ZXI7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ2FjaGUgKyBpbi1mbGlnaHQgY29hbGVzY2luZyAoc3VjY2Vzc2Z1bCB0ZXh0IGJvZGllcyBvbmx5KVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmNvbnN0IGJvZHlDYWNoZSA9IG5ldyBUdGxDYWNoZTxzdHJpbmc+KDYwMCk7XG5jb25zdCBpbkZsaWdodCA9IG5ldyBNYXA8c3RyaW5nLCBQcm9taXNlPHN0cmluZz4+KCk7XG5cbmFzeW5jIGZ1bmN0aW9uIGRvRmV0Y2goXG4gIHVybDogc3RyaW5nLFxuICBob3N0OiBzdHJpbmcsXG4gIGhlYWRlcnM6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQsXG4gIHRpbWVvdXRNczogbnVtYmVyLFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2godXJsLCB7XG4gICAgaGVhZGVyczogeyAnVXNlci1BZ2VudCc6IEJST1dTRVJfVUEsIC4uLmhlYWRlcnMgfSxcbiAgICByZWRpcmVjdDogJ2ZvbGxvdycsXG4gICAgc2lnbmFsOiBBYm9ydFNpZ25hbC50aW1lb3V0KHRpbWVvdXRNcyksXG4gIH0pO1xuICBpZiAoIXJlcy5vaykge1xuICAgIHRocm93IG5ldyBIdHRwRXJyb3IoYEhUVFAgJHtyZXMuc3RhdHVzfSBmcm9tICR7aG9zdH1gLCByZXMuc3RhdHVzKTtcbiAgfVxuICByZXR1cm4gcmVzLnRleHQoKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hXaXRoUmV0cnkoXG4gIHVybDogc3RyaW5nLFxuICBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkLFxuICB0aW1lb3V0TXM6IG51bWJlcixcbik6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IGhvc3QgPSBuZXcgVVJMKHVybCkuaG9zdG5hbWU7XG4gIGxldCBsYXN0RXJyOiB1bmtub3duO1xuICBmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IE1BWF9BVFRFTVBUUzsgYXR0ZW1wdCsrKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiBhd2FpdCBsaW1pdGVyRm9yKGhvc3QpLnJ1bigoKSA9PiBkb0ZldGNoKHVybCwgaG9zdCwgaGVhZGVycywgdGltZW91dE1zKSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBsYXN0RXJyID0gZXJyO1xuICAgICAgY29uc3Qgc3RhdHVzID0gZXJyIGluc3RhbmNlb2YgSHR0cEVycm9yID8gZXJyLnN0YXR1cyA6IHVuZGVmaW5lZDtcbiAgICAgIGNvbnN0IHJldHJ5YWJsZSA9XG4gICAgICAgIHN0YXR1cyA9PT0gdW5kZWZpbmVkIHx8IHN0YXR1cyA9PT0gNDI5IHx8IHN0YXR1cyA+PSA1MDA7XG4gICAgICBpZiAoIXJldHJ5YWJsZSB8fCBhdHRlbXB0ID09PSBNQVhfQVRURU1QVFMgLSAxKSB0aHJvdyBlcnI7XG4gICAgICBhd2FpdCBzbGVlcChSRVRSWV9ERUxBWVNfTVNbYXR0ZW1wdF0gPz8gMTUwMCk7XG4gICAgfVxuICB9XG4gIC8vIFVucmVhY2hhYmxlLCBidXQga2VlcHMgVFMgaGFwcHkuXG4gIHRocm93IGxhc3RFcnIgaW5zdGFuY2VvZiBFcnJvciA/IGxhc3RFcnIgOiBuZXcgRXJyb3IoYGZldGNoIGZhaWxlZDogJHt1cmx9YCk7XG59XG5cbi8qKiBGZXRjaCBhIFVSTCBhcyB0ZXh0LCBob25vcmluZyB0aGUgVFRMIGNhY2hlIGFuZCBwZXItaG9zdCBsaW1pdHMuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hUZXh0KHVybDogc3RyaW5nLCBvcHRzOiBGZXRjaE9wdGlvbnMgPSB7fSk6IFByb21pc2U8c3RyaW5nPiB7XG4gIGNvbnN0IHR0bE1zID0gb3B0cy50dGxNcyA/PyAwO1xuICBjb25zdCB0aW1lb3V0TXMgPSBvcHRzLnRpbWVvdXRNcyA/PyBERUZBVUxUX1RJTUVPVVRfTVM7XG5cbiAgaWYgKHR0bE1zID4gMCkge1xuICAgIGNvbnN0IGNhY2hlZCA9IGJvZHlDYWNoZS5nZXQodXJsKTtcbiAgICBpZiAoY2FjaGVkICE9PSB1bmRlZmluZWQpIHJldHVybiBjYWNoZWQ7XG4gICAgY29uc3QgcGVuZGluZyA9IGluRmxpZ2h0LmdldCh1cmwpO1xuICAgIGlmIChwZW5kaW5nKSByZXR1cm4gcGVuZGluZztcbiAgfVxuXG4gIGNvbnN0IHByb21pc2UgPSBmZXRjaFdpdGhSZXRyeSh1cmwsIG9wdHMuaGVhZGVycywgdGltZW91dE1zKVxuICAgIC50aGVuKChib2R5KSA9PiB7XG4gICAgICBpZiAodHRsTXMgPiAwKSBib2R5Q2FjaGUuc2V0KHVybCwgYm9keSwgdHRsTXMpO1xuICAgICAgcmV0dXJuIGJvZHk7XG4gICAgfSlcbiAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICBpbkZsaWdodC5kZWxldGUodXJsKTtcbiAgICB9KTtcblxuICBpZiAodHRsTXMgPiAwKSBpbkZsaWdodC5zZXQodXJsLCBwcm9taXNlKTtcbiAgcmV0dXJuIHByb21pc2U7XG59XG5cbi8qKiBGZXRjaCBhIFVSTCBhbmQgSlNPTi5wYXJzZSB0aGUgYm9keS4gVCBkZXNjcmliZXMgdGhlIGV4cGVjdGVkIHJhdyBzaGFwZS4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaEpzb248VD4odXJsOiBzdHJpbmcsIG9wdHM6IEZldGNoT3B0aW9ucyA9IHt9KTogUHJvbWlzZTxUPiB7XG4gIGNvbnN0IGJvZHkgPSBhd2FpdCBmZXRjaFRleHQodXJsLCBvcHRzKTtcbiAgdHJ5IHtcbiAgICByZXR1cm4gSlNPTi5wYXJzZShib2R5KSBhcyBUO1xuICB9IGNhdGNoIHtcbiAgICAvLyBBIGNhY2hlZCBib2R5IHNob3VsZCBuZXZlciBiZSB1bnBhcnNlYWJsZSBKU09OIHVubGVzcyB0aGUgZW5kcG9pbnRcbiAgICAvLyByZXR1cm5lZCBIVE1MIChlLmcuIGFuIGVycm9yIHBhZ2UpIFx1MjAxNCBkb24ndCBrZWVwIHNlcnZpbmcgaXQuXG4gICAgYm9keUNhY2hlLmRlbGV0ZSh1cmwpO1xuICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBKU09OIGZyb20gJHtuZXcgVVJMKHVybCkuaG9zdG5hbWV9YCk7XG4gIH1cbn1cbiIsICIvLyBZYWhvbyBGaW5hbmNlIGNsaWVudC4gVGhlIHY4IGNoYXJ0IGFuZCB2MSBzZWFyY2ggZW5kcG9pbnRzIHdvcmsgd2l0aCBqdXN0XG4vLyBhIGJyb3dzZXIgVUEuIHF1b3RlU3VtbWFyeSAodjEwKSByZXF1aXJlcyBhIGNvb2tpZSArIGNydW1iIHBhaXIsIHdoaWNoIG1heVxuLy8gZmFpbCBhdCBhbnkgdGltZSBcdTIwMTQgY2FsbGVycyBtdXN0IGRlZ3JhZGUgZ3JhY2VmdWxseSB3aGVuIGl0IHRocm93cy5cblxuaW1wb3J0IHsgQlJPV1NFUl9VQSwgZmV0Y2hKc29uLCBIdHRwRXJyb3IgfSBmcm9tICcuL2h0dHAnO1xuXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbi8vIFJhdyByZXNwb25zZSBzaGFwZXMgKHR5cGVkIGF0IHRoZSBKU09OIHBhcnNlIGJvdW5kYXJ5OyBmaWVsZHMgb3B0aW9uYWwpXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGludGVyZmFjZSBZYWhvb0NoYXJ0TWV0YSB7XG4gIGN1cnJlbmN5Pzogc3RyaW5nIHwgbnVsbDtcbiAgZXhjaGFuZ2VOYW1lPzogc3RyaW5nIHwgbnVsbDtcbiAgcmVndWxhck1hcmtldFByaWNlPzogbnVtYmVyIHwgbnVsbDtcbiAgY2hhcnRQcmV2aW91c0Nsb3NlPzogbnVtYmVyIHwgbnVsbDtcbiAgcHJldmlvdXNDbG9zZT86IG51bWJlciB8IG51bGw7XG4gIG1hcmtldFN0YXRlPzogc3RyaW5nIHwgbnVsbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBZYWhvb0NoYXJ0UmVzdWx0IHtcbiAgbWV0YT86IFlhaG9vQ2hhcnRNZXRhO1xuICB0aW1lc3RhbXA/OiBBcnJheTxudW1iZXIgfCBudWxsPjtcbiAgaW5kaWNhdG9ycz86IHtcbiAgICBxdW90ZT86IEFycmF5PHtcbiAgICAgIG9wZW4/OiBBcnJheTxudW1iZXIgfCBudWxsPjtcbiAgICAgIGhpZ2g/OiBBcnJheTxudW1iZXIgfCBudWxsPjtcbiAgICAgIGxvdz86IEFycmF5PG51bWJlciB8IG51bGw+O1xuICAgICAgY2xvc2U/OiBBcnJheTxudW1iZXIgfCBudWxsPjtcbiAgICAgIHZvbHVtZT86IEFycmF5PG51bWJlciB8IG51bGw+O1xuICAgIH0+O1xuICB9O1xufVxuXG5pbnRlcmZhY2UgWWFob29DaGFydFJlc3BvbnNlIHtcbiAgY2hhcnQ/OiB7XG4gICAgcmVzdWx0PzogWWFob29DaGFydFJlc3VsdFtdIHwgbnVsbDtcbiAgICBlcnJvcj86IHsgY29kZT86IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfSB8IG51bGw7XG4gIH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgWWFob29TZWFyY2hRdW90ZSB7XG4gIHN5bWJvbD86IHN0cmluZztcbiAgc2hvcnRuYW1lPzogc3RyaW5nO1xuICBsb25nbmFtZT86IHN0cmluZztcbiAgcXVvdGVUeXBlPzogc3RyaW5nO1xuICBleGNoRGlzcD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFlhaG9vU2VhcmNoUmVzcG9uc2Uge1xuICBxdW90ZXM/OiBZYWhvb1NlYXJjaFF1b3RlW107XG59XG5cbi8qKiByYXcgbnVtYmVyIHwge3JhdzogbnVtYmVyfSB8IGZvcm1hdHRlZC1zdHJpbmcgdW5pb25zIGZyb20gcXVvdGVTdW1tYXJ5ICovXG5leHBvcnQgdHlwZSBZYWhvb1Jhd1ZhbHVlID1cbiAgfCBudW1iZXJcbiAgfCBzdHJpbmdcbiAgfCB7IHJhdz86IG51bWJlciB8IG51bGw7IGZtdD86IHN0cmluZyB8IG51bGwgfVxuICB8IG51bGxcbiAgfCB1bmRlZmluZWQ7XG5cbmV4cG9ydCBpbnRlcmZhY2UgWWFob29RdW90ZVN1bW1hcnlSZXN1bHQge1xuICBwcmljZT86IHtcbiAgICBsb25nTmFtZT86IHN0cmluZyB8IG51bGw7XG4gICAgc2hvcnROYW1lPzogc3RyaW5nIHwgbnVsbDtcbiAgICBtYXJrZXRTdGF0ZT86IHN0cmluZyB8IG51bGw7XG4gIH07XG4gIHRvcEhvbGRpbmdzPzoge1xuICAgIGhvbGRpbmdzPzogQXJyYXk8e1xuICAgICAgc3ltYm9sPzogc3RyaW5nO1xuICAgICAgaG9sZGluZ05hbWU/OiBzdHJpbmc7XG4gICAgICBob2xkaW5nUGVyY2VudD86IFlhaG9vUmF3VmFsdWU7XG4gICAgfT47XG4gIH07XG4gIGNhbGVuZGFyRXZlbnRzPzoge1xuICAgIGVhcm5pbmdzPzoge1xuICAgICAgZWFybmluZ3NEYXRlPzogWWFob29SYXdWYWx1ZVtdO1xuICAgICAgZWFybmluZ3NBdmVyYWdlPzogWWFob29SYXdWYWx1ZTtcbiAgICAgIGVhcm5pbmdzQ2FsbFRpbWU/OiBzdHJpbmcgfCBudWxsO1xuICAgICAgY2FsbFRpbWU/OiBzdHJpbmcgfCBudWxsO1xuICAgICAgaXNFYXJuaW5nc0RhdGVFc3RpbWF0ZT86IFlhaG9vUmF3VmFsdWUgfCBib29sZWFuO1xuICAgIH07XG4gIH07XG59XG5cbmludGVyZmFjZSBZYWhvb1F1b3RlU3VtbWFyeVJlc3BvbnNlIHtcbiAgcXVvdGVTdW1tYXJ5Pzoge1xuICAgIHJlc3VsdD86IFlhaG9vUXVvdGVTdW1tYXJ5UmVzdWx0W10gfCBudWxsO1xuICAgIGVycm9yPzogeyBjb2RlPzogc3RyaW5nOyBkZXNjcmlwdGlvbj86IHN0cmluZyB9IHwgbnVsbDtcbiAgfTtcbn1cblxuLyoqIENvZXJjZSBZYWhvbydzIG51bWJlciB8IHtyYXd9IHVuaW9ucyB0byBhIGZpbml0ZSBudW1iZXIgb3IgbnVsbC4gKi9cbmV4cG9ydCBmdW5jdGlvbiByYXdOdW1iZXIodmFsdWU6IFlhaG9vUmF3VmFsdWUpOiBudW1iZXIgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkgcmV0dXJuIHZhbHVlO1xuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IHJhdyA9IHZhbHVlLnJhdztcbiAgICBpZiAodHlwZW9mIHJhdyA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHJhdykpIHJldHVybiByYXc7XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8vIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuLy8gQ2hhcnQgKyBzZWFyY2ggKG5vIGF1dGgpXG4vLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoWWFob29DaGFydChcbiAgc3ltYm9sOiBzdHJpbmcsXG4gIHlhaG9vUmFuZ2U6IHN0cmluZyxcbiAgaW50ZXJ2YWw6IHN0cmluZyxcbiAgdHRsTXM6IG51bWJlcixcbik6IFByb21pc2U8WWFob29DaGFydFJlc3VsdD4ge1xuICBjb25zdCB1cmwgPVxuICAgIGBodHRwczovL3F1ZXJ5MS5maW5hbmNlLnlhaG9vLmNvbS92OC9maW5hbmNlL2NoYXJ0LyR7ZW5jb2RlVVJJQ29tcG9uZW50KHN5bWJvbCl9YCArXG4gICAgYD9yYW5nZT0ke2VuY29kZVVSSUNvbXBvbmVudCh5YWhvb1JhbmdlKX0maW50ZXJ2YWw9JHtlbmNvZGVVUklDb21wb25lbnQoaW50ZXJ2YWwpfSZpbmNsdWRlUHJlUG9zdD1mYWxzZWA7XG4gIGNvbnN0IGpzb24gPSBhd2FpdCBmZXRjaEpzb248WWFob29DaGFydFJlc3BvbnNlPih1cmwsIHsgdHRsTXMgfSk7XG4gIGNvbnN0IHJlc3VsdCA9IGpzb24uY2hhcnQ/LnJlc3VsdD8uWzBdO1xuICBpZiAoIXJlc3VsdCB8fCAhcmVzdWx0Lm1ldGEpIHtcbiAgICBjb25zdCBkZXNjID0ganNvbi5jaGFydD8uZXJyb3I/LmRlc2NyaXB0aW9uID8/ICdlbXB0eSBjaGFydCByZXN1bHQnO1xuICAgIHRocm93IG5ldyBFcnJvcihgWWFob28gY2hhcnQgZmFpbGVkIGZvciAke3N5bWJvbH06ICR7ZGVzY31gKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2VhcmNoWWFob28ocXVlcnk6IHN0cmluZyk6IFByb21pc2U8WWFob29TZWFyY2hRdW90ZVtdPiB7XG4gIGNvbnN0IHVybCA9XG4gICAgYGh0dHBzOi8vcXVlcnkxLmZpbmFuY2UueWFob28uY29tL3YxL2ZpbmFuY2Uvc2VhcmNoYCArXG4gICAgYD9xPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHF1ZXJ5KX0mcXVvdGVzQ291bnQ9OCZuZXdzQ291bnQ9MGA7XG4gIGNvbnN0IGpzb24gPSBhd2FpdCBmZXRjaEpzb248WWFob29TZWFyY2hSZXNwb25zZT4odXJsLCB7IHR0bE1zOiAxMCAqIDYwXzAwMCB9KTtcbiAgcmV0dXJuIEFycmF5LmlzQXJyYXkoanNvbi5xdW90ZXMpID8ganNvbi5xdW90ZXMgOiBbXTtcbn1cblxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4vLyBDb29raWUgKyBjcnVtYiAobmVlZGVkIGZvciBxdW90ZVN1bW1hcnk7IHVudmVyaWZpZWQgZW5kcG9pbnQgXHUyMDE0IG1heSBmYWlsKVxuLy8gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cbmludGVyZmFjZSBDcnVtYlN0YXRlIHtcbiAgY29va2llOiBzdHJpbmc7XG4gIGNydW1iOiBzdHJpbmc7XG4gIGZldGNoZWRBdDogbnVtYmVyO1xufVxuXG5jb25zdCBDUlVNQl9UVExfTVMgPSAzMCAqIDYwXzAwMDtcbmxldCBjcnVtYlN0YXRlOiBDcnVtYlN0YXRlIHwgbnVsbCA9IG51bGw7XG5sZXQgY3J1bWJQcm9taXNlOiBQcm9taXNlPENydW1iU3RhdGU+IHwgbnVsbCA9IG51bGw7XG5cbmZ1bmN0aW9uIGludmFsaWRhdGVDcnVtYigpOiB2b2lkIHtcbiAgY3J1bWJTdGF0ZSA9IG51bGw7XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGZldGNoQ29va2llKCk6IFByb21pc2U8c3RyaW5nPiB7XG4gIC8vIGZjLnlhaG9vLmNvbSB0eXBpY2FsbHkgNDA0cyBcdTIwMTQgd2Ugb25seSB3YW50IGl0cyBTZXQtQ29va2llIGhlYWRlci5cbiAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goJ2h0dHBzOi8vZmMueWFob28uY29tLycsIHtcbiAgICBoZWFkZXJzOiB7ICdVc2VyLUFnZW50JzogQlJPV1NFUl9VQSB9LFxuICAgIHJlZGlyZWN0OiAnbWFudWFsJyxcbiAgICBzaWduYWw6IEFib3J0U2lnbmFsLnRpbWVvdXQoMTJfMDAwKSxcbiAgfSk7XG4gIGxldCBjb29raWVzOiBzdHJpbmdbXSA9IFtdO1xuICB0cnkge1xuICAgIGNvb2tpZXMgPSByZXMuaGVhZGVycy5nZXRTZXRDb29raWUoKTtcbiAgfSBjYXRjaCB7XG4gICAgLyogb2xkZXIgcnVudGltZXMgKi9cbiAgfVxuICBpZiAoY29va2llcy5sZW5ndGggPT09IDApIHtcbiAgICBjb25zdCBzaW5nbGUgPSByZXMuaGVhZGVycy5nZXQoJ3NldC1jb29raWUnKTtcbiAgICBpZiAoc2luZ2xlKSBjb29raWVzID0gW3NpbmdsZV07XG4gIH1cbiAgY29uc3QgcGFydHMgPSBjb29raWVzXG4gICAgLm1hcCgoYykgPT4gYy5zcGxpdCgnOycpWzBdLnRyaW0oKSlcbiAgICAuZmlsdGVyKChjKSA9PiBjLmluY2x1ZGVzKCc9JykpO1xuICBpZiAocGFydHMubGVuZ3RoID09PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ1lhaG9vIHJldHVybmVkIG5vIGNvb2tpZScpO1xuICByZXR1cm4gcGFydHMuam9pbignOyAnKTtcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hDcnVtYlN0YXRlKCk6IFByb21pc2U8Q3J1bWJTdGF0ZT4ge1xuICBjb25zdCBjb29raWUgPSBhd2FpdCBmZXRjaENvb2tpZSgpO1xuICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCgnaHR0cHM6Ly9xdWVyeTEuZmluYW5jZS55YWhvby5jb20vdjEvdGVzdC9nZXRjcnVtYicsIHtcbiAgICBoZWFkZXJzOiB7ICdVc2VyLUFnZW50JzogQlJPV1NFUl9VQSwgQ29va2llOiBjb29raWUgfSxcbiAgICBzaWduYWw6IEFib3J0U2lnbmFsLnRpbWVvdXQoMTJfMDAwKSxcbiAgfSk7XG4gIGlmICghcmVzLm9rKSB0aHJvdyBuZXcgSHR0cEVycm9yKGBnZXRjcnVtYiBIVFRQICR7cmVzLnN0YXR1c31gLCByZXMuc3RhdHVzKTtcbiAgY29uc3QgY3J1bWIgPSAoYXdhaXQgcmVzLnRleHQoKSkudHJpbSgpO1xuICBpZiAoIWNydW1iIHx8IGNydW1iLmxlbmd0aCA+IDY0IHx8IGNydW1iLmluY2x1ZGVzKCc8JykgfHwgY3J1bWIuaW5jbHVkZXMoJ3snKSkge1xuICAgIHRocm93IG5ldyBFcnJvcignWWFob28gcmV0dXJuZWQgYW4gaW52YWxpZCBjcnVtYicpO1xuICB9XG4gIHJldHVybiB7IGNvb2tpZSwgY3J1bWIsIGZldGNoZWRBdDogRGF0ZS5ub3coKSB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRDcnVtYihmb3JjZSA9IGZhbHNlKTogUHJvbWlzZTxDcnVtYlN0YXRlPiB7XG4gIGlmIChmb3JjZSkgaW52YWxpZGF0ZUNydW1iKCk7XG4gIGlmIChjcnVtYlN0YXRlICYmIERhdGUubm93KCkgLSBjcnVtYlN0YXRlLmZldGNoZWRBdCA8IENSVU1CX1RUTF9NUykge1xuICAgIHJldHVybiBjcnVtYlN0YXRlO1xuICB9XG4gIGlmICghY3J1bWJQcm9taXNlKSB7XG4gICAgY3J1bWJQcm9taXNlID0gZmV0Y2hDcnVtYlN0YXRlKClcbiAgICAgIC50aGVuKChzdGF0ZSkgPT4ge1xuICAgICAgICBjcnVtYlN0YXRlID0gc3RhdGU7XG4gICAgICAgIHJldHVybiBzdGF0ZTtcbiAgICAgIH0pXG4gICAgICAuZmluYWxseSgoKSA9PiB7XG4gICAgICAgIGNydW1iUHJvbWlzZSA9IG51bGw7XG4gICAgICB9KTtcbiAgfVxuICByZXR1cm4gY3J1bWJQcm9taXNlO1xufVxuXG4vKipcbiAqIEZldGNoIHF1b3RlU3VtbWFyeSBtb2R1bGVzIGZvciBhIHN5bWJvbC4gVGhyb3dzIG9uIGFueSBmYWlsdXJlIFx1MjAxNCBjYWxsZXJzXG4gKiBmYWxsIGJhY2sgdG8gYnVuZGxlZC9zYW1wbGUgZGF0YS4gUmVzdWx0cyBhcmUgTk9UIGNhY2hlZCBoZXJlIChzZXJ2aWNlc1xuICoga2VlcCB0aGVpciBvd24gbG9uZ2VyLWxpdmVkIGNhY2hlcyBrZXllZCBieSBzeW1ib2wpLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcXVvdGVTdW1tYXJ5KFxuICBzeW1ib2w6IHN0cmluZyxcbiAgbW9kdWxlczogc3RyaW5nW10sXG4pOiBQcm9taXNlPFlhaG9vUXVvdGVTdW1tYXJ5UmVzdWx0PiB7XG4gIGxldCBsYXN0RXJyOiB1bmtub3duO1xuICBmb3IgKGxldCBhdHRlbXB0ID0gMDsgYXR0ZW1wdCA8IDI7IGF0dGVtcHQrKykge1xuICAgIGNvbnN0IHsgY29va2llLCBjcnVtYiB9ID0gYXdhaXQgZ2V0Q3J1bWIoYXR0ZW1wdCA+IDApO1xuICAgIGNvbnN0IHVybCA9XG4gICAgICBgaHR0cHM6Ly9xdWVyeTEuZmluYW5jZS55YWhvby5jb20vdjEwL2ZpbmFuY2UvcXVvdGVTdW1tYXJ5LyR7ZW5jb2RlVVJJQ29tcG9uZW50KHN5bWJvbCl9YCArXG4gICAgICBgP21vZHVsZXM9JHtlbmNvZGVVUklDb21wb25lbnQobW9kdWxlcy5qb2luKCcsJykpfSZjcnVtYj0ke2VuY29kZVVSSUNvbXBvbmVudChjcnVtYil9YDtcbiAgICB0cnkge1xuICAgICAgY29uc3QganNvbiA9IGF3YWl0IGZldGNoSnNvbjxZYWhvb1F1b3RlU3VtbWFyeVJlc3BvbnNlPih1cmwsIHtcbiAgICAgICAgdHRsTXM6IDAsXG4gICAgICAgIGhlYWRlcnM6IHsgQ29va2llOiBjb29raWUgfSxcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcmVzdWx0ID0ganNvbi5xdW90ZVN1bW1hcnk/LnJlc3VsdD8uWzBdO1xuICAgICAgaWYgKCFyZXN1bHQpIHtcbiAgICAgICAgY29uc3QgZGVzYyA9IGpzb24ucXVvdGVTdW1tYXJ5Py5lcnJvcj8uZGVzY3JpcHRpb24gPz8gJ2VtcHR5IHJlc3VsdCc7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgcXVvdGVTdW1tYXJ5IGZhaWxlZCBmb3IgJHtzeW1ib2x9OiAke2Rlc2N9YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgbGFzdEVyciA9IGVycjtcbiAgICAgIGNvbnN0IHN0YXR1cyA9IGVyciBpbnN0YW5jZW9mIEh0dHBFcnJvciA/IGVyci5zdGF0dXMgOiB1bmRlZmluZWQ7XG4gICAgICBpZiAoKHN0YXR1cyA9PT0gNDAxIHx8IHN0YXR1cyA9PT0gNDAzKSAmJiBhdHRlbXB0ID09PSAwKSB7XG4gICAgICAgIGludmFsaWRhdGVDcnVtYigpO1xuICAgICAgICBjb250aW51ZTsgLy8gb25lIHJldHJ5IHdpdGggYSBmcmVzaCBjcnVtYlxuICAgICAgfVxuICAgICAgdGhyb3cgZXJyO1xuICAgIH1cbiAgfVxuICB0aHJvdyBsYXN0RXJyIGluc3RhbmNlb2YgRXJyb3IgPyBsYXN0RXJyIDogbmV3IEVycm9yKGBxdW90ZVN1bW1hcnkgZmFpbGVkIGZvciAke3N5bWJvbH1gKTtcbn1cbiIsICIvLyBjaGFydDpnZXQgXHUyMDE0IGNhbmRsZXMgZnJvbSBZYWhvbydzIHY4IGNoYXJ0IGVuZHBvaW50IHdpdGggY2xlYW4gYXNjZW5kaW5nXG4vLyBjYW5kbGVzIChudWxsIGNsb3NlcyBza2lwcGVkLCBPSExDIHNhbml0eS1jbGFtcGVkKS4gQW55IGZhaWx1cmUgZmFsbHNcbi8vIGJhY2sgdG8gdGhlIGRldGVybWluaXN0aWMgc2FtcGxlIHdhbGssIGZsYWdnZWQgc291cmNlICdzYW1wbGUnLlxuXG5pbXBvcnQgdHlwZSB7IENhbmRsZSwgQ2hhcnREYXRhLCBDaGFydFJhbmdlIH0gZnJvbSAnLi4vLi4vc2hhcmVkL3R5cGVzJztcbmltcG9ydCB7IHNhbXBsZUNoYXJ0IH0gZnJvbSAnLi9zYW1wbGUnO1xuaW1wb3J0IHsgZmV0Y2hZYWhvb0NoYXJ0IH0gZnJvbSAnLi95YWhvbyc7XG5cbmludGVyZmFjZSBSYW5nZVNwZWMge1xuICB5YWhvb1JhbmdlOiBzdHJpbmc7XG4gIGludGVydmFsOiBzdHJpbmc7XG4gIHR0bE1zOiBudW1iZXI7XG59XG5cbmNvbnN0IElOVFJBREFZX1RUTCA9IDYwXzAwMDtcbmNvbnN0IERBSUxZX1RUTCA9IDEwICogNjBfMDAwO1xuXG5jb25zdCBSQU5HRV9NQVA6IFJlY29yZDxDaGFydFJhbmdlLCBSYW5nZVNwZWM+ID0ge1xuICAnMWQnOiB7IHlhaG9vUmFuZ2U6ICcxZCcsIGludGVydmFsOiAnNW0nLCB0dGxNczogSU5UUkFEQVlfVFRMIH0sXG4gICcxdyc6IHsgeWFob29SYW5nZTogJzVkJywgaW50ZXJ2YWw6ICcxNW0nLCB0dGxNczogSU5UUkFEQVlfVFRMIH0sXG4gICcxbSc6IHsgeWFob29SYW5nZTogJzFtbycsIGludGVydmFsOiAnNjBtJywgdHRsTXM6IElOVFJBREFZX1RUTCB9LFxuICAnNm0nOiB7IHlhaG9vUmFuZ2U6ICc2bW8nLCBpbnRlcnZhbDogJzFkJywgdHRsTXM6IERBSUxZX1RUTCB9LFxuICAnMXknOiB7IHlhaG9vUmFuZ2U6ICcxeScsIGludGVydmFsOiAnMWQnLCB0dGxNczogREFJTFlfVFRMIH0sXG4gICc1eSc6IHsgeWFob29SYW5nZTogJzV5JywgaW50ZXJ2YWw6ICcxd2snLCB0dGxNczogREFJTFlfVFRMIH0sXG4gIG1heDogeyB5YWhvb1JhbmdlOiAnbWF4JywgaW50ZXJ2YWw6ICcxbW8nLCB0dGxNczogREFJTFlfVFRMIH0sXG59O1xuXG5mdW5jdGlvbiBpc0Zpbml0ZU51bWJlcih2OiBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkKTogdiBpcyBudW1iZXIge1xuICByZXR1cm4gdHlwZW9mIHYgPT09ICdudW1iZXInICYmIE51bWJlci5pc0Zpbml0ZSh2KTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldENoYXJ0KHN5bWJvbDogc3RyaW5nLCByYW5nZTogQ2hhcnRSYW5nZSk6IFByb21pc2U8Q2hhcnREYXRhPiB7XG4gIGNvbnN0IHNwZWMgPSBSQU5HRV9NQVBbcmFuZ2VdO1xuICB0cnkge1xuICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IGZldGNoWWFob29DaGFydChzeW1ib2wsIHNwZWMueWFob29SYW5nZSwgc3BlYy5pbnRlcnZhbCwgc3BlYy50dGxNcyk7XG4gICAgY29uc3QgbWV0YSA9IHJlc3VsdC5tZXRhID8/IHt9O1xuICAgIGNvbnN0IHRpbWVzdGFtcHMgPSBBcnJheS5pc0FycmF5KHJlc3VsdC50aW1lc3RhbXApID8gcmVzdWx0LnRpbWVzdGFtcCA6IFtdO1xuICAgIGNvbnN0IHF1b3RlID0gcmVzdWx0LmluZGljYXRvcnM/LnF1b3RlPy5bMF0gPz8ge307XG4gICAgY29uc3Qgb3BlbnMgPSBxdW90ZS5vcGVuID8/IFtdO1xuICAgIGNvbnN0IGhpZ2hzID0gcXVvdGUuaGlnaCA/PyBbXTtcbiAgICBjb25zdCBsb3dzID0gcXVvdGUubG93ID8/IFtdO1xuICAgIGNvbnN0IGNsb3NlcyA9IHF1b3RlLmNsb3NlID8/IFtdO1xuICAgIGNvbnN0IHZvbHVtZXMgPSBxdW90ZS52b2x1bWUgPz8gW107XG5cbiAgICBjb25zdCBieVNlY29uZCA9IG5ldyBNYXA8bnVtYmVyLCBDYW5kbGU+KCk7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aW1lc3RhbXBzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB0aW1lID0gdGltZXN0YW1wc1tpXTtcbiAgICAgIGNvbnN0IGNsb3NlID0gY2xvc2VzW2ldO1xuICAgICAgaWYgKCFpc0Zpbml0ZU51bWJlcih0aW1lKSB8fCAhaXNGaW5pdGVOdW1iZXIoY2xvc2UpKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHJhd09wZW4gPSBvcGVuc1tpXTtcbiAgICAgIGNvbnN0IHJhd0hpZ2ggPSBoaWdoc1tpXTtcbiAgICAgIGNvbnN0IHJhd0xvdyA9IGxvd3NbaV07XG4gICAgICBjb25zdCByYXdWb2x1bWUgPSB2b2x1bWVzW2ldO1xuICAgICAgY29uc3Qgb3BlbiA9IGlzRmluaXRlTnVtYmVyKHJhd09wZW4pID8gcmF3T3BlbiA6IGNsb3NlO1xuICAgICAgbGV0IGhpZ2ggPSBpc0Zpbml0ZU51bWJlcihyYXdIaWdoKSA/IHJhd0hpZ2ggOiBNYXRoLm1heChvcGVuLCBjbG9zZSk7XG4gICAgICBsZXQgbG93ID0gaXNGaW5pdGVOdW1iZXIocmF3TG93KSA/IHJhd0xvdyA6IE1hdGgubWluKG9wZW4sIGNsb3NlKTtcbiAgICAgIGhpZ2ggPSBNYXRoLm1heChoaWdoLCBvcGVuLCBjbG9zZSk7XG4gICAgICBsb3cgPSBNYXRoLm1pbihsb3csIG9wZW4sIGNsb3NlKTtcbiAgICAgIGNvbnN0IHZvbHVtZSA9IGlzRmluaXRlTnVtYmVyKHJhd1ZvbHVtZSkgPyByYXdWb2x1bWUgOiAwO1xuICAgICAgLy8gbGFzdCB3cml0ZSB3aW5zIGZvciBkdXBsaWNhdGUgdGltZXN0YW1wcyAoWWFob28gcmVwZWF0cyB0aGUgbGl2ZSBiYXIpXG4gICAgICBieVNlY29uZC5zZXQoTWF0aC5mbG9vcih0aW1lKSwgeyB0aW1lOiBNYXRoLmZsb29yKHRpbWUpLCBvcGVuLCBoaWdoLCBsb3csIGNsb3NlLCB2b2x1bWUgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FuZGxlcyA9IFsuLi5ieVNlY29uZC52YWx1ZXMoKV0uc29ydCgoYSwgYikgPT4gYS50aW1lIC0gYi50aW1lKTtcbiAgICBpZiAoY2FuZGxlcy5sZW5ndGggPT09IDApIHRocm93IG5ldyBFcnJvcihgbm8gdXNhYmxlIGNhbmRsZXMgZm9yICR7c3ltYm9sfSAke3JhbmdlfWApO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN5bWJvbCxcbiAgICAgIHJhbmdlLFxuICAgICAgaW50ZXJ2YWw6IHNwZWMuaW50ZXJ2YWwsXG4gICAgICBjYW5kbGVzLFxuICAgICAgY3VycmVuY3k6IHR5cGVvZiBtZXRhLmN1cnJlbmN5ID09PSAnc3RyaW5nJyAmJiBtZXRhLmN1cnJlbmN5ID8gbWV0YS5jdXJyZW5jeSA6ICdVU0QnLFxuICAgICAgZXhjaGFuZ2VOYW1lOlxuICAgICAgICB0eXBlb2YgbWV0YS5leGNoYW5nZU5hbWUgPT09ICdzdHJpbmcnICYmIG1ldGEuZXhjaGFuZ2VOYW1lXG4gICAgICAgICAgPyBtZXRhLmV4Y2hhbmdlTmFtZVxuICAgICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgcmVndWxhck1hcmtldFByaWNlOiBpc0Zpbml0ZU51bWJlcihtZXRhLnJlZ3VsYXJNYXJrZXRQcmljZSlcbiAgICAgICAgPyBtZXRhLnJlZ3VsYXJNYXJrZXRQcmljZVxuICAgICAgICA6IG51bGwsXG4gICAgICBwcmV2aW91c0Nsb3NlOiBpc0Zpbml0ZU51bWJlcihtZXRhLmNoYXJ0UHJldmlvdXNDbG9zZSlcbiAgICAgICAgPyBtZXRhLmNoYXJ0UHJldmlvdXNDbG9zZVxuICAgICAgICA6IGlzRmluaXRlTnVtYmVyKG1ldGEucHJldmlvdXNDbG9zZSlcbiAgICAgICAgICA/IG1ldGEucHJldmlvdXNDbG9zZVxuICAgICAgICAgIDogbnVsbCxcbiAgICAgIHNvdXJjZTogJ2xpdmUnLFxuICAgIH07XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBzYW1wbGVDaGFydChzeW1ib2wsIHJhbmdlKTtcbiAgfVxufVxuIiwgIi8vIGVhcm5pbmdzOmdldCBcdTIwMTQgdXBjb21pbmcgZWFybmluZ3MgcGVyIHN5bWJvbCB2aWEgcXVvdGVTdW1tYXJ5XG4vLyBjYWxlbmRhckV2ZW50cyAoK3ByaWNlIGZvciB0aGUgY29tcGFueSBuYW1lKS4gQ29va2llL2NydW1iIG1heSBmYWlsIGF0XG4vLyBhbnkgdGltZTsgZWFjaCBmYWlsZWQgc3ltYm9sIGRlZ3JhZGVzIHRvIGEgZGV0ZXJtaW5pc3RpYyBzYW1wbGUgZXZlbnQuXG5cbmltcG9ydCB0eXBlIHsgRWFybmluZ3NFdmVudCwgRWFybmluZ3NUaW1lIH0gZnJvbSAnLi4vLi4vc2hhcmVkL3R5cGVzJztcbmltcG9ydCB7IFR0bENhY2hlIH0gZnJvbSAnLi9jYWNoZSc7XG5pbXBvcnQgeyBsb29rdXBOYW1lIH0gZnJvbSAnLi9kYXRhRmlsZXMnO1xuaW1wb3J0IHsgc2FtcGxlRWFybmluZ3MgfSBmcm9tICcuL3NhbXBsZSc7XG5pbXBvcnQgeyBwTGltaXQsIHRvWW1kIH0gZnJvbSAnLi91dGlsJztcbmltcG9ydCB7IHF1b3RlU3VtbWFyeSwgcmF3TnVtYmVyLCBZYWhvb1Jhd1ZhbHVlIH0gZnJvbSAnLi95YWhvbyc7XG5cbmNvbnN0IExJVkVfVFRMX01TID0gNiAqIDYwICogNjBfMDAwOyAvLyA2aFxuY29uc3QgU0FNUExFX1RUTF9NUyA9IDEwICogNjBfMDAwOyAvLyByZXRyeSBsaXZlIHNvb25lciBhZnRlciBmYWlsdXJlc1xuY29uc3QgV0lORE9XX0RBWVMgPSAxMjA7XG5jb25zdCBsaW1pdCA9IHBMaW1pdCgzKTtcblxuLy8gbnVsbCA9IGxpdmUgc2FpZCBcIm5vIHVwY29taW5nIGVhcm5pbmdzXCIgKGNhY2hlZCBzbyB3ZSBkb24ndCByZWZldGNoKS5cbmNvbnN0IGNhY2hlID0gbmV3IFR0bENhY2hlPEVhcm5pbmdzRXZlbnQgfCBudWxsPig0MDApO1xuXG5mdW5jdGlvbiB0b0Vwb2NoTXModmFsdWU6IFlhaG9vUmF3VmFsdWUpOiBudW1iZXIgfCBudWxsIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkge1xuICAgIHJldHVybiB2YWx1ZSA+IDFlMTIgPyB2YWx1ZSA6IHZhbHVlICogMTAwMDtcbiAgfVxuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgIGNvbnN0IG1zID0gRGF0ZS5wYXJzZSh2YWx1ZSk7XG4gICAgcmV0dXJuIE51bWJlci5pc05hTihtcykgPyBudWxsIDogbXM7XG4gIH1cbiAgaWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcpIHtcbiAgICBjb25zdCByYXcgPSB2YWx1ZS5yYXc7XG4gICAgaWYgKHR5cGVvZiByYXcgPT09ICdudW1iZXInICYmIE51bWJlci5pc0Zpbml0ZShyYXcpKSB7XG4gICAgICByZXR1cm4gcmF3ID4gMWUxMiA/IHJhdyA6IHJhdyAqIDEwMDA7XG4gICAgfVxuICAgIGNvbnN0IGZtdCA9IHZhbHVlLmZtdDtcbiAgICBpZiAodHlwZW9mIGZtdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IG1zID0gRGF0ZS5wYXJzZShmbXQpO1xuICAgICAgcmV0dXJuIE51bWJlci5pc05hTihtcykgPyBudWxsIDogbXM7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiBkZXRlY3RUaW1lKGNhbmRpZGF0ZXM6IEFycmF5PHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQ+KTogRWFybmluZ3NUaW1lIHtcbiAgZm9yIChjb25zdCBjIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICBpZiAodHlwZW9mIGMgIT09ICdzdHJpbmcnKSBjb250aW51ZTtcbiAgICBjb25zdCB2ID0gYy50b0xvd2VyQ2FzZSgpO1xuICAgIGlmICh2LmluY2x1ZGVzKCdibW8nKSB8fCB2LmluY2x1ZGVzKCdiZWZvcmUnKSkgcmV0dXJuICdibW8nO1xuICAgIGlmICh2LmluY2x1ZGVzKCdhbWMnKSB8fCB2LmluY2x1ZGVzKCdhZnRlcicpKSByZXR1cm4gJ2FtYyc7XG4gIH1cbiAgcmV0dXJuICd1bmtub3duJztcbn1cblxuYXN5bmMgZnVuY3Rpb24gZmV0Y2hMaXZlRXZlbnQoc3ltYm9sOiBzdHJpbmcpOiBQcm9taXNlPEVhcm5pbmdzRXZlbnQgfCBudWxsPiB7XG4gIGNvbnN0IHN1bW1hcnkgPSBhd2FpdCBxdW90ZVN1bW1hcnkoc3ltYm9sLCBbJ2NhbGVuZGFyRXZlbnRzJywgJ3ByaWNlJ10pO1xuICBjb25zdCBlYXJuaW5ncyA9IHN1bW1hcnkuY2FsZW5kYXJFdmVudHM/LmVhcm5pbmdzO1xuICBjb25zdCBjb21wYW55TmFtZSA9XG4gICAgc3VtbWFyeS5wcmljZT8ubG9uZ05hbWUgfHxcbiAgICBzdW1tYXJ5LnByaWNlPy5zaG9ydE5hbWUgfHxcbiAgICBsb29rdXBOYW1lKHN5bWJvbCkgfHxcbiAgICBzeW1ib2w7XG5cbiAgY29uc3QgZGF0ZXMgPSBBcnJheS5pc0FycmF5KGVhcm5pbmdzPy5lYXJuaW5nc0RhdGUpID8gZWFybmluZ3MuZWFybmluZ3NEYXRlIDogW107XG4gIGNvbnN0IHN0YXJ0T2ZUb2RheSA9IERhdGUucGFyc2UoYCR7dG9ZbWQobmV3IERhdGUoKSl9VDAwOjAwOjAwWmApO1xuICBjb25zdCB3aW5kb3dFbmQgPSBzdGFydE9mVG9kYXkgKyBXSU5ET1dfREFZUyAqIDg2XzQwMF8wMDA7XG5cbiAgbGV0IG5leHRNczogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIGZvciAoY29uc3QgZCBvZiBkYXRlcykge1xuICAgIGNvbnN0IG1zID0gdG9FcG9jaE1zKGQpO1xuICAgIGlmIChtcyA9PT0gbnVsbCB8fCBtcyA8IHN0YXJ0T2ZUb2RheSB8fCBtcyA+IHdpbmRvd0VuZCkgY29udGludWU7XG4gICAgaWYgKG5leHRNcyA9PT0gbnVsbCB8fCBtcyA8IG5leHRNcykgbmV4dE1zID0gbXM7XG4gIH1cbiAgaWYgKG5leHRNcyA9PT0gbnVsbCkgcmV0dXJuIG51bGw7IC8vIGxpdmUgc3VjY2VlZGVkLCBub3RoaW5nIHVwY29taW5nXG5cbiAgcmV0dXJuIHtcbiAgICBzeW1ib2wsXG4gICAgY29tcGFueU5hbWUsXG4gICAgZGF0ZTogdG9ZbWQobmV3IERhdGUobmV4dE1zKSksXG4gICAgdGltZTogZGV0ZWN0VGltZShbZWFybmluZ3M/LmVhcm5pbmdzQ2FsbFRpbWUsIGVhcm5pbmdzPy5jYWxsVGltZV0pLFxuICAgIGVwc0VzdGltYXRlOiByYXdOdW1iZXIoZWFybmluZ3M/LmVhcm5pbmdzQXZlcmFnZSksXG4gICAgc291cmNlOiAnbGl2ZScsXG4gIH07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGV2ZW50Rm9yKHN5bWJvbDogc3RyaW5nKTogUHJvbWlzZTxFYXJuaW5nc0V2ZW50IHwgbnVsbD4ge1xuICBjb25zdCBjYWNoZWQgPSBjYWNoZS5nZXQoc3ltYm9sKTtcbiAgaWYgKGNhY2hlZCAhPT0gdW5kZWZpbmVkKSByZXR1cm4gY2FjaGVkO1xuICB0cnkge1xuICAgIGNvbnN0IGV2ZW50ID0gYXdhaXQgbGltaXQoKCkgPT4gZmV0Y2hMaXZlRXZlbnQoc3ltYm9sKSk7XG4gICAgY2FjaGUuc2V0KHN5bWJvbCwgZXZlbnQsIExJVkVfVFRMX01TKTtcbiAgICByZXR1cm4gZXZlbnQ7XG4gIH0gY2F0Y2gge1xuICAgIGNvbnN0IGV2ZW50ID0gc2FtcGxlRWFybmluZ3Moc3ltYm9sKTtcbiAgICBjYWNoZS5zZXQoc3ltYm9sLCBldmVudCwgU0FNUExFX1RUTF9NUyk7XG4gICAgcmV0dXJuIGV2ZW50O1xuICB9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRFYXJuaW5ncyhzeW1ib2xzOiBzdHJpbmdbXSk6IFByb21pc2U8RWFybmluZ3NFdmVudFtdPiB7XG4gIGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbChzeW1ib2xzLm1hcCgocykgPT4gZXZlbnRGb3IocykpKTtcbiAgY29uc3QgZXZlbnRzID0gcmVzdWx0cy5maWx0ZXIoKGUpOiBlIGlzIEVhcm5pbmdzRXZlbnQgPT4gZSAhPT0gbnVsbCk7XG4gIGV2ZW50cy5zb3J0KChhLCBiKSA9PiBhLmRhdGUubG9jYWxlQ29tcGFyZShiLmRhdGUpIHx8IGEuc3ltYm9sLmxvY2FsZUNvbXBhcmUoYi5zeW1ib2wpKTtcbiAgcmV0dXJuIGV2ZW50cztcbn1cbiIsICIvLyBob2xkaW5nczpnZXQgXHUyMDE0IHRvcC0yMCBFVEYgaG9sZGluZ3MuIFRyaWVzIHRoZSBsaXZlIHF1b3RlU3VtbWFyeVxuLy8gdG9wSG9sZGluZ3MgbW9kdWxlICh1c3VhbGx5IHRvcCAxMCkgYW5kIG1lcmdlcyBpdCBvdmVyIHRoZSBidW5kbGVkXG4vLyBzbmFwc2hvdCAobGl2ZSB3ZWlnaHRzIHdpbiwgYnVuZGxlIGZpbGxzIHRoZSBsaXN0IG91dCB0byAyMCkuIEFueVxuLy8gZmFpbHVyZSByZXR1cm5zIHRoZSBidW5kbGVkIGRhdGEgZmxhZ2dlZCAnc2FtcGxlJy5cblxuaW1wb3J0IHR5cGUgeyBIb2xkaW5nLCBIb2xkaW5nc1Jlc3VsdCB9IGZyb20gJy4uLy4uL3NoYXJlZC90eXBlcyc7XG5pbXBvcnQgeyBUdGxDYWNoZSB9IGZyb20gJy4vY2FjaGUnO1xuaW1wb3J0IHsgZ2V0QnVuZGxlQXNPZiwgZ2V0RXRmQnVuZGxlIH0gZnJvbSAnLi9kYXRhRmlsZXMnO1xuaW1wb3J0IHsgcm91bmQyLCB0b2RheVltZCB9IGZyb20gJy4vdXRpbCc7XG5pbXBvcnQgeyBxdW90ZVN1bW1hcnksIHJhd051bWJlciB9IGZyb20gJy4veWFob28nO1xuXG5jb25zdCBMSVZFX1RUTF9NUyA9IDEyICogNjAgKiA2MF8wMDA7IC8vIDEyaFxuY29uc3QgU0FNUExFX1RUTF9NUyA9IDE1ICogNjBfMDAwOyAvLyByZXRyeSBsaXZlIHNvb25lciBhZnRlciBhIGZhaWx1cmVcbmNvbnN0IE1BWF9IT0xESU5HUyA9IDIwO1xuXG5jb25zdCBjYWNoZSA9IG5ldyBUdGxDYWNoZTxIb2xkaW5nc1Jlc3VsdD4oMjAwKTtcbmNvbnN0IGluRmxpZ2h0ID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8SG9sZGluZ3NSZXN1bHQ+PigpO1xuXG5mdW5jdGlvbiBidW5kbGVkUmVzdWx0KGV0ZlN5bWJvbDogc3RyaW5nKTogSG9sZGluZ3NSZXN1bHQge1xuICBjb25zdCBlbnRyeSA9IGdldEV0ZkJ1bmRsZSgpLmV0ZnNbZXRmU3ltYm9sXTtcbiAgcmV0dXJuIHtcbiAgICBldGZTeW1ib2wsXG4gICAgYXNPZjogZ2V0QnVuZGxlQXNPZigpLFxuICAgIGhvbGRpbmdzOiBlbnRyeSA/IGVudHJ5LmhvbGRpbmdzLnNsaWNlKDAsIE1BWF9IT0xESU5HUykgOiBbXSxcbiAgICBzb3VyY2U6ICdzYW1wbGUnLFxuICB9O1xufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaExpdmVIb2xkaW5ncyhldGZTeW1ib2w6IHN0cmluZyk6IFByb21pc2U8SG9sZGluZ1tdPiB7XG4gIGNvbnN0IHN1bW1hcnkgPSBhd2FpdCBxdW90ZVN1bW1hcnkoZXRmU3ltYm9sLCBbJ3RvcEhvbGRpbmdzJ10pO1xuICBjb25zdCByYXcgPSBzdW1tYXJ5LnRvcEhvbGRpbmdzPy5ob2xkaW5ncztcbiAgaWYgKCFBcnJheS5pc0FycmF5KHJhdykgfHwgcmF3Lmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgbm8gbGl2ZSB0b3BIb2xkaW5ncyBmb3IgJHtldGZTeW1ib2x9YCk7XG4gIH1cbiAgY29uc3Qgb3V0OiBIb2xkaW5nW10gPSBbXTtcbiAgZm9yIChjb25zdCBoIG9mIHJhdykge1xuICAgIGNvbnN0IHN5bWJvbCA9IHR5cGVvZiBoLnN5bWJvbCA9PT0gJ3N0cmluZycgPyBoLnN5bWJvbC50b1VwcGVyQ2FzZSgpLnRyaW0oKSA6ICcnO1xuICAgIGlmICghc3ltYm9sIHx8IG91dC5zb21lKCh4KSA9PiB4LnN5bWJvbCA9PT0gc3ltYm9sKSkgY29udGludWU7XG4gICAgY29uc3QgZnJhY3Rpb24gPSByYXdOdW1iZXIoaC5ob2xkaW5nUGVyY2VudCk7XG4gICAgb3V0LnB1c2goe1xuICAgICAgc3ltYm9sLFxuICAgICAgbmFtZTogdHlwZW9mIGguaG9sZGluZ05hbWUgPT09ICdzdHJpbmcnICYmIGguaG9sZGluZ05hbWUgPyBoLmhvbGRpbmdOYW1lIDogc3ltYm9sLFxuICAgICAgd2VpZ2h0UGVyY2VudDogZnJhY3Rpb24gPT09IG51bGwgPyBudWxsIDogcm91bmQyKGZyYWN0aW9uICogMTAwKSxcbiAgICB9KTtcbiAgfVxuICBpZiAob3V0Lmxlbmd0aCA9PT0gMCkgdGhyb3cgbmV3IEVycm9yKGB1bnVzYWJsZSBsaXZlIHRvcEhvbGRpbmdzIGZvciAke2V0ZlN5bWJvbH1gKTtcbiAgcmV0dXJuIG91dDtcbn1cblxuZnVuY3Rpb24gbWVyZ2VXaXRoQnVuZGxlKGV0ZlN5bWJvbDogc3RyaW5nLCBsaXZlOiBIb2xkaW5nW10pOiBIb2xkaW5nW10ge1xuICBjb25zdCBtZXJnZWQ6IEhvbGRpbmdbXSA9IFsuLi5saXZlXTtcbiAgY29uc3QgYnVuZGxlID0gZ2V0RXRmQnVuZGxlKCkuZXRmc1tldGZTeW1ib2xdO1xuICBpZiAoYnVuZGxlKSB7XG4gICAgZm9yIChjb25zdCBoIG9mIGJ1bmRsZS5ob2xkaW5ncykge1xuICAgICAgaWYgKG1lcmdlZC5sZW5ndGggPj0gTUFYX0hPTERJTkdTKSBicmVhaztcbiAgICAgIGlmIChtZXJnZWQuc29tZSgoeCkgPT4geC5zeW1ib2wgPT09IGguc3ltYm9sKSkgY29udGludWU7XG4gICAgICBtZXJnZWQucHVzaChoKTtcbiAgICB9XG4gICAgLy8gUHJlZmVyIHRoZSBjdXJhdGVkIG5hbWVzIHdoZXJlIGxpdmUgZ2F2ZSB1cyBub25lL3RlcnNlIG9uZXM/IExpdmUgd2luc1xuICAgIC8vIHBlciBzcGVjIFx1MjAxNCBidXQgZG8gYmFja2ZpbGwgbWlzc2luZyBuYW1lcyBmcm9tIHRoZSBidW5kbGUuXG4gICAgZm9yIChjb25zdCBpdGVtIG9mIG1lcmdlZCkge1xuICAgICAgaWYgKGl0ZW0ubmFtZSA9PT0gaXRlbS5zeW1ib2wpIHtcbiAgICAgICAgY29uc3Qga25vd24gPSBidW5kbGUuaG9sZGluZ3MuZmluZCgoeCkgPT4geC5zeW1ib2wgPT09IGl0ZW0uc3ltYm9sKTtcbiAgICAgICAgaWYgKGtub3duKSBpdGVtLm5hbWUgPSBrbm93bi5uYW1lO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBtZXJnZWQuc29ydCgoYSwgYikgPT4gKGIud2VpZ2h0UGVyY2VudCA/PyAtMSkgLSAoYS53ZWlnaHRQZXJjZW50ID8/IC0xKSk7XG4gIHJldHVybiBtZXJnZWQuc2xpY2UoMCwgTUFYX0hPTERJTkdTKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldEhvbGRpbmdzKGV0ZlN5bWJvbDogc3RyaW5nKTogUHJvbWlzZTxIb2xkaW5nc1Jlc3VsdD4ge1xuICBjb25zdCBzeW0gPSBldGZTeW1ib2wudG9VcHBlckNhc2UoKTtcbiAgY29uc3QgY2FjaGVkID0gY2FjaGUuZ2V0KHN5bSk7XG4gIGlmIChjYWNoZWQpIHJldHVybiBjYWNoZWQ7XG4gIGNvbnN0IHBlbmRpbmcgPSBpbkZsaWdodC5nZXQoc3ltKTtcbiAgaWYgKHBlbmRpbmcpIHJldHVybiBwZW5kaW5nO1xuXG4gIGNvbnN0IHByb21pc2UgPSAoYXN5bmMgKCk6IFByb21pc2U8SG9sZGluZ3NSZXN1bHQ+ID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3QgbGl2ZSA9IGF3YWl0IGZldGNoTGl2ZUhvbGRpbmdzKHN5bSk7XG4gICAgICBjb25zdCByZXN1bHQ6IEhvbGRpbmdzUmVzdWx0ID0ge1xuICAgICAgICBldGZTeW1ib2w6IHN5bSxcbiAgICAgICAgYXNPZjogdG9kYXlZbWQoKSxcbiAgICAgICAgaG9sZGluZ3M6IG1lcmdlV2l0aEJ1bmRsZShzeW0sIGxpdmUpLFxuICAgICAgICBzb3VyY2U6ICdsaXZlJyxcbiAgICAgIH07XG4gICAgICBjYWNoZS5zZXQoc3ltLCByZXN1bHQsIExJVkVfVFRMX01TKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBjYXRjaCB7XG4gICAgICBjb25zdCByZXN1bHQgPSBidW5kbGVkUmVzdWx0KHN5bSk7XG4gICAgICBjYWNoZS5zZXQoc3ltLCByZXN1bHQsIFNBTVBMRV9UVExfTVMpO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gIH0pKCkuZmluYWxseSgoKSA9PiB7XG4gICAgaW5GbGlnaHQuZGVsZXRlKHN5bSk7XG4gIH0pO1xuXG4gIGluRmxpZ2h0LnNldChzeW0sIHByb21pc2UpO1xuICByZXR1cm4gcHJvbWlzZTtcbn1cbiIsICIvLyBSU1MgMi4wIHBhcnNpbmcgc2hhcmVkIGJ5IHRoZSBZYWhvbyBwZXItdGlja2VyIGZlZWQgYW5kIEdvb2dsZSBOZXdzLlxuLy8gZmFzdC14bWwtcGFyc2VyIHdpdGggaXNBcnJheSBmb3IgPGl0ZW0+IHNvIHNpbmdsZS1pdGVtIGNoYW5uZWxzIHN0aWxsXG4vLyBjb21lIGJhY2sgYXMgYXJyYXlzLiBUaXRsZXMgYXJlIGtlcHQgYXMgcmF3IHN0cmluZ3MgKHBhcnNlVGFnVmFsdWUgb2ZmKVxuLy8gc28gaGVhZGxpbmVzIGxpa2UgXCIzTVwiIGRvbid0IGdldCBjb2VyY2VkIHRvIG51bWJlcnMuXG5cbmltcG9ydCB7IFhNTFBhcnNlciB9IGZyb20gJ2Zhc3QteG1sLXBhcnNlcic7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUnNzSXRlbSB7XG4gIHRpdGxlOiBzdHJpbmc7XG4gIGxpbms6IHN0cmluZztcbiAgcHViRGF0ZT86IHN0cmluZztcbiAgZGVzY3JpcHRpb24/OiBzdHJpbmc7XG4gIC8qKiBQdWJsaXNoZXIgZnJvbSB0aGUgPHNvdXJjZT4gdGFnIHdoZW4gcHJlc2VudCAoR29vZ2xlIE5ld3MgaGFzIGl0KS4gKi9cbiAgc291cmNlTmFtZT86IHN0cmluZztcbn1cblxuY29uc3QgcGFyc2VyID0gbmV3IFhNTFBhcnNlcih7XG4gIGlnbm9yZUF0dHJpYnV0ZXM6IGZhbHNlLFxuICBpc0FycmF5OiAobmFtZSkgPT4gbmFtZSA9PT0gJ2l0ZW0nLFxuICBwYXJzZVRhZ1ZhbHVlOiBmYWxzZSxcbiAgdHJpbVZhbHVlczogdHJ1ZSxcbn0pO1xuXG5mdW5jdGlvbiB0ZXh0T2YodmFsdWU6IHVua25vd24pOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcmV0dXJuIHZhbHVlLnRyaW0oKTtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHJldHVybiBTdHJpbmcodmFsdWUpO1xuICBpZiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IHRleHQgPSAodmFsdWUgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pWycjdGV4dCddO1xuICAgIGlmICh0eXBlb2YgdGV4dCA9PT0gJ3N0cmluZycpIHJldHVybiB0ZXh0LnRyaW0oKTtcbiAgICBpZiAodHlwZW9mIHRleHQgPT09ICdudW1iZXInKSByZXR1cm4gU3RyaW5nKHRleHQpO1xuICB9XG4gIHJldHVybiAnJztcbn1cblxuLyoqIFBhcnNlIGFuIFJTUyAyLjAgZG9jdW1lbnQgaW50byBub3JtYWxpemVkIGl0ZW1zLiBCYWQgWE1MIFx1MjE5MiBbXS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVJzc0l0ZW1zKHhtbDogc3RyaW5nKTogUnNzSXRlbVtdIHtcbiAgbGV0IGRvYzogdW5rbm93bjtcbiAgdHJ5IHtcbiAgICBkb2MgPSBwYXJzZXIucGFyc2UoeG1sKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG4gIGNvbnN0IGNoYW5uZWwgPSAoZG9jIGFzIHsgcnNzPzogeyBjaGFubmVsPzogeyBpdGVtPzogdW5rbm93biB9IH0gfSkucnNzPy5jaGFubmVsO1xuICBjb25zdCByYXdJdGVtcyA9IGNoYW5uZWw/Lml0ZW07XG4gIGlmICghQXJyYXkuaXNBcnJheShyYXdJdGVtcykpIHJldHVybiBbXTtcblxuICBjb25zdCBvdXQ6IFJzc0l0ZW1bXSA9IFtdO1xuICBmb3IgKGNvbnN0IHJhdyBvZiByYXdJdGVtcykge1xuICAgIGlmICghcmF3IHx8IHR5cGVvZiByYXcgIT09ICdvYmplY3QnKSBjb250aW51ZTtcbiAgICBjb25zdCBpdGVtID0gcmF3IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+O1xuICAgIGNvbnN0IHRpdGxlID0gdGV4dE9mKGl0ZW0udGl0bGUpO1xuICAgIGNvbnN0IGxpbmsgPSB0ZXh0T2YoaXRlbS5saW5rKTtcbiAgICBpZiAoIXRpdGxlIHx8ICFsaW5rKSBjb250aW51ZTtcbiAgICBjb25zdCBwdWJEYXRlID0gdGV4dE9mKGl0ZW0ucHViRGF0ZSk7XG4gICAgY29uc3QgZGVzY3JpcHRpb24gPSB0ZXh0T2YoaXRlbS5kZXNjcmlwdGlvbik7XG4gICAgY29uc3Qgc291cmNlTmFtZSA9IHRleHRPZihpdGVtLnNvdXJjZSk7XG4gICAgb3V0LnB1c2goe1xuICAgICAgdGl0bGUsXG4gICAgICBsaW5rLFxuICAgICAgcHViRGF0ZTogcHViRGF0ZSB8fCB1bmRlZmluZWQsXG4gICAgICBkZXNjcmlwdGlvbjogZGVzY3JpcHRpb24gfHwgdW5kZWZpbmVkLFxuICAgICAgc291cmNlTmFtZTogc291cmNlTmFtZSB8fCB1bmRlZmluZWQsXG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIG91dDtcbn1cbiIsICIvLyBuZXdzOmdldCBcdTIwMTQgWWFob28gcGVyLXRpY2tlciBSU1MsIGZldGNoZWQgcGVyIHN5bWJvbCAoY29uY3VycmVuY3kgNCxcbi8vIDEwLW1pbnV0ZSBUVEwgcGVyIGZlZWQpLCBkZWR1cGVkIGFjcm9zcyBzeW1ib2xzIGJ5IG5vcm1hbGl6ZWQgdGl0bGUsXG4vLyBzb3J0ZWQgbmV3ZXN0IGZpcnN0LCBjYXBwZWQgYXQgMTAwLiBUb3RhbCBmYWlsdXJlIFx1MjE5MiBkZXRlcm1pbmlzdGljXG4vLyBzYW1wbGUgaXRlbXMgKHNvdXJjZU5hbWUgJ1NhbXBsZSBEYXRhJywgaWRzIHByZWZpeGVkICdzYW1wbGUtJykuXG5cbmltcG9ydCB0eXBlIHsgTmV3c0l0ZW0gfSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgZmV0Y2hUZXh0IH0gZnJvbSAnLi9odHRwJztcbmltcG9ydCB7IHBhcnNlUnNzSXRlbXMgfSBmcm9tICcuL3Jzcyc7XG5pbXBvcnQgeyBzYW1wbGVOZXdzIH0gZnJvbSAnLi9zYW1wbGUnO1xuaW1wb3J0IHtcbiAgaGFzaElkLFxuICBub3JtYWxpemVUaXRsZSxcbiAgcGFyc2VEYXRlTXMsXG4gIHBMaW1pdCxcbiAgc3RyaXBIdG1sLFxufSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBGRUVEX1RUTF9NUyA9IDEwICogNjBfMDAwO1xuY29uc3QgTUFYX1NZTUJPTFMgPSA0MDtcbmNvbnN0IE1BWF9UT1RBTCA9IDEwMDtcbmNvbnN0IGxpbWl0ID0gcExpbWl0KDQpO1xuXG4vKipcbiAqIEZldGNoIGFuZCBtYXAgdGhlIGZ1bGwgWWFob28gUlNTIGZlZWQgZm9yIG9uZSBzeW1ib2wgKHVuY2FwcGVkKS5cbiAqIFNoYXJlZCB3aXRoIHBpdm90TmV3cywgd2hpY2ggZmlsdGVycyBpdGVtcyBpbnRvIHBpdm90IHdpbmRvd3MuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmZXRjaFN5bWJvbEZlZWQoc3ltYm9sOiBzdHJpbmcpOiBQcm9taXNlPE5ld3NJdGVtW10+IHtcbiAgY29uc3QgdXJsID1cbiAgICBgaHR0cHM6Ly9mZWVkcy5maW5hbmNlLnlhaG9vLmNvbS9yc3MvMi4wL2hlYWRsaW5lYCArXG4gICAgYD9zPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHN5bWJvbCl9JnJlZ2lvbj1VUyZsYW5nPWVuLVVTYDtcbiAgY29uc3QgeG1sID0gYXdhaXQgZmV0Y2hUZXh0KHVybCwgeyB0dGxNczogRkVFRF9UVExfTVMgfSk7XG4gIGNvbnN0IGl0ZW1zID0gcGFyc2VSc3NJdGVtcyh4bWwpO1xuXG4gIGNvbnN0IG91dDogTmV3c0l0ZW1bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICBjb25zdCBwdWJsaXNoZWRNcyA9IHBhcnNlRGF0ZU1zKGl0ZW0ucHViRGF0ZSk7XG4gICAgY29uc3Qgc3VtbWFyeSA9IGl0ZW0uZGVzY3JpcHRpb24gPyBzdHJpcEh0bWwoaXRlbS5kZXNjcmlwdGlvbikuc2xpY2UoMCwgMzAwKSA6IHVuZGVmaW5lZDtcbiAgICBvdXQucHVzaCh7XG4gICAgICBpZDogYHktJHtoYXNoSWQoYCR7aXRlbS5saW5rfXwke2l0ZW0udGl0bGV9YCl9YCxcbiAgICAgIHRpdGxlOiBpdGVtLnRpdGxlLFxuICAgICAgdXJsOiBpdGVtLmxpbmssXG4gICAgICBzb3VyY2VOYW1lOiBpdGVtLnNvdXJjZU5hbWUgfHwgJ1lhaG9vIEZpbmFuY2UnLFxuICAgICAgcHVibGlzaGVkQXQ6IG5ldyBEYXRlKHB1Ymxpc2hlZE1zID8/IERhdGUubm93KCkpLnRvSVNPU3RyaW5nKCksXG4gICAgICByZWxhdGVkU3ltYm9sOiBzeW1ib2wsXG4gICAgICBzdW1tYXJ5OiBzdW1tYXJ5ICYmIHN1bW1hcnkgIT09IGl0ZW0udGl0bGUgPyBzdW1tYXJ5IDogdW5kZWZpbmVkLFxuICAgIH0pO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXROZXdzKHN5bWJvbHM6IHN0cmluZ1tdLCBsaW1pdFBlclN5bWJvbCA9IDYpOiBQcm9taXNlPE5ld3NJdGVtW10+IHtcbiAgY29uc3QgcmVxdWVzdGVkID0gc3ltYm9scy5zbGljZSgwLCBNQVhfU1lNQk9MUyk7XG4gIGlmIChyZXF1ZXN0ZWQubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cbiAgY29uc3QgcGVyU3ltYm9sID0gYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgcmVxdWVzdGVkLm1hcCgoc3ltYm9sKSA9PlxuICAgICAgbGltaXQoKCkgPT4gZmV0Y2hTeW1ib2xGZWVkKHN5bWJvbCkpLmNhdGNoKCgpID0+IG51bGwpLFxuICAgICksXG4gICk7XG5cbiAgY29uc3QgYWxsRmFpbGVkID0gcGVyU3ltYm9sLmV2ZXJ5KChyKSA9PiByID09PSBudWxsKTtcbiAgaWYgKGFsbEZhaWxlZCkgcmV0dXJuIHNhbXBsZU5ld3MocmVxdWVzdGVkKTtcblxuICBjb25zdCBzZWVuVGl0bGVzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IG1lcmdlZDogTmV3c0l0ZW1bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGZlZWQgb2YgcGVyU3ltYm9sKSB7XG4gICAgaWYgKCFmZWVkKSBjb250aW51ZTtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgZmVlZC5zbGljZSgwLCBsaW1pdFBlclN5bWJvbCkpIHtcbiAgICAgIGNvbnN0IGtleSA9IG5vcm1hbGl6ZVRpdGxlKGl0ZW0udGl0bGUpO1xuICAgICAgaWYgKCFrZXkgfHwgc2VlblRpdGxlcy5oYXMoa2V5KSkgY29udGludWU7XG4gICAgICBzZWVuVGl0bGVzLmFkZChrZXkpO1xuICAgICAgbWVyZ2VkLnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG5cbiAgbWVyZ2VkLnNvcnQoKGEsIGIpID0+IGIucHVibGlzaGVkQXQubG9jYWxlQ29tcGFyZShhLnB1Ymxpc2hlZEF0KSk7XG4gIHJldHVybiBtZXJnZWQuc2xpY2UoMCwgTUFYX1RPVEFMKTtcbn1cbiIsICIvLyBHb29nbGUgTmV3cyBSU1Mgc2VhcmNoIFx1MjAxNCB1c2VkIGJ5IHBpdm90TmV3cyBmb3IgZGF0ZS1ib3VuZGVkIHF1ZXJpZXMgbGlrZVxuLy8gXCJOVkRBIHN0b2NrIGFmdGVyOjIwMjYtMDEtMDUgYmVmb3JlOjIwMjYtMDEtMTJcIi4gSXRlbSB0aXRsZXMgdXN1YWxseSBlbmRcbi8vIHdpdGggXCIgLSBQdWJsaXNoZXJcIjsgdGhlIDxzb3VyY2U+IHRhZyBob2xkcyB0aGUgcHVibGlzaGVyIG5hbWUuXG5cbmltcG9ydCB0eXBlIHsgTmV3c0l0ZW0gfSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgZmV0Y2hUZXh0IH0gZnJvbSAnLi9odHRwJztcbmltcG9ydCB7IHBhcnNlUnNzSXRlbXMgfSBmcm9tICcuL3Jzcyc7XG5pbXBvcnQgeyBoYXNoSWQsIHBhcnNlRGF0ZU1zIH0gZnJvbSAnLi91dGlsJztcblxuLyoqIFN0cmlwIGEgdHJhaWxpbmcgXCIgLSBQdWJsaXNoZXJcIiBzdWZmaXggd2hlbiBpdCBtYXRjaGVzIHRoZSBzb3VyY2UgdGFnLiAqL1xuZnVuY3Rpb24gY2xlYW5UaXRsZSh0aXRsZTogc3RyaW5nLCBwdWJsaXNoZXI6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG4gIGNvbnN0IGlkeCA9IHRpdGxlLmxhc3RJbmRleE9mKCcgLSAnKTtcbiAgaWYgKGlkeCA8PSAwKSByZXR1cm4gdGl0bGU7XG4gIGNvbnN0IHN1ZmZpeCA9IHRpdGxlLnNsaWNlKGlkeCArIDMpLnRyaW0oKTtcbiAgaWYgKHB1Ymxpc2hlciAmJiBzdWZmaXgudG9Mb3dlckNhc2UoKSA9PT0gcHVibGlzaGVyLnRvTG93ZXJDYXNlKCkpIHtcbiAgICByZXR1cm4gdGl0bGUuc2xpY2UoMCwgaWR4KS50cmltKCk7XG4gIH1cbiAgLy8gTm8gc291cmNlIHRhZzogc3RpbGwgc3RyaXAgYSBzaG9ydCB0cmFpbGluZyBwdWJsaXNoZXItbG9va2luZyBzdWZmaXguXG4gIGlmICghcHVibGlzaGVyICYmIHN1ZmZpeC5sZW5ndGggPD0gNDAgJiYgIXN1ZmZpeC5pbmNsdWRlcygnIC0gJykpIHtcbiAgICByZXR1cm4gdGl0bGUuc2xpY2UoMCwgaWR4KS50cmltKCk7XG4gIH1cbiAgcmV0dXJuIHRpdGxlO1xufVxuXG4vKipcbiAqIFNlYXJjaCBHb29nbGUgTmV3cyBmb3IgYSBzeW1ib2wgd2l0aGluIGEgVVRDIGRhdGUgd2luZG93IChpbmNsdXNpdmUtaXNoO1xuICogR29vZ2xlIHRyZWF0cyBhZnRlcjovYmVmb3JlOiBhcyBkYXkgYm91bmRzKS4gQ2FjaGVkIGJ5IFVSTCwgd2hpY2ggZW5jb2Rlc1xuICogc3ltYm9sICsgd2luZG93LCBzbyByZXBlYXQgcGl2b3QgbG9va3VwcyB3aXRoaW4gdHRsTXMgYXJlIGZyZWUuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZWFyY2hHb29nbGVOZXdzKFxuICBzeW1ib2w6IHN0cmluZyxcbiAgYWZ0ZXJZbWQ6IHN0cmluZyxcbiAgYmVmb3JlWW1kOiBzdHJpbmcsXG4gIHR0bE1zOiBudW1iZXIsXG4pOiBQcm9taXNlPE5ld3NJdGVtW10+IHtcbiAgY29uc3QgcXVlcnkgPSBgJHtzeW1ib2x9IHN0b2NrIGFmdGVyOiR7YWZ0ZXJZbWR9IGJlZm9yZToke2JlZm9yZVltZH1gO1xuICBjb25zdCB1cmwgPVxuICAgIGBodHRwczovL25ld3MuZ29vZ2xlLmNvbS9yc3Mvc2VhcmNoP3E9JHtlbmNvZGVVUklDb21wb25lbnQocXVlcnkpfWAgK1xuICAgIGAmaGw9ZW4tVVMmZ2w9VVMmY2VpZD1VUzplbmA7XG4gIGNvbnN0IHhtbCA9IGF3YWl0IGZldGNoVGV4dCh1cmwsIHsgdHRsTXMgfSk7XG4gIGNvbnN0IGl0ZW1zID0gcGFyc2VSc3NJdGVtcyh4bWwpO1xuXG4gIGNvbnN0IG91dDogTmV3c0l0ZW1bXSA9IFtdO1xuICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICBjb25zdCBwdWJsaXNoZWRNcyA9IHBhcnNlRGF0ZU1zKGl0ZW0ucHViRGF0ZSk7XG4gICAgaWYgKHB1Ymxpc2hlZE1zID09PSBudWxsKSBjb250aW51ZTsgLy8gdW5kYXRlZCBpdGVtcyBhcmUgdXNlbGVzcyBuZWFyIHBpdm90c1xuICAgIGNvbnN0IHB1Ymxpc2hlciA9IGl0ZW0uc291cmNlTmFtZTtcbiAgICBvdXQucHVzaCh7XG4gICAgICBpZDogYGctJHtoYXNoSWQoYCR7aXRlbS5saW5rfXwke2l0ZW0udGl0bGV9YCl9YCxcbiAgICAgIHRpdGxlOiBjbGVhblRpdGxlKGl0ZW0udGl0bGUsIHB1Ymxpc2hlciksXG4gICAgICB1cmw6IGl0ZW0ubGluayxcbiAgICAgIHNvdXJjZU5hbWU6IHB1Ymxpc2hlciB8fCAnR29vZ2xlIE5ld3MnLFxuICAgICAgcHVibGlzaGVkQXQ6IG5ldyBEYXRlKHB1Ymxpc2hlZE1zKS50b0lTT1N0cmluZygpLFxuICAgICAgcmVsYXRlZFN5bWJvbDogc3ltYm9sLFxuICAgIH0pO1xuICB9XG4gIHJldHVybiBvdXQ7XG59XG4iLCAiLy8gY2hhcnQ6cGl2b3QtbmV3cyBcdTIwMTQgZm9yIGVhY2ggZGV0ZWN0ZWQgcGl2b3QsIGZpbmQgZGF0ZWQgYXJ0aWNsZXMgbmVhciB0aGVcbi8vIHBpdm90OiBHb29nbGUgTmV3cyBSU1Mgd2l0aCBhIFx1MDBCMTUgZGF5IHdpbmRvdyBwbHVzIGFueSBZYWhvbyBwZXItdGlja2VyIFJTU1xuLy8gaXRlbXMgdGhhdCBmYWxsIGluc2lkZSB0aGUgd2luZG93LiBEZWR1cGVkIGJ5IHRpdGxlLCBzb3J0ZWQgYnkgZGlzdGFuY2Vcbi8vIHRvIHRoZSBwaXZvdCwgbWF4IDQgcGVyIHBpdm90LiBPbmUgcGl2b3QgZmFpbGluZyBuZXZlciBmYWlscyB0aGUgYmF0Y2gsXG4vLyBhbmQgaW5wdXQgcGl2b3Qgb3JkZXIgaXMgcHJlc2VydmVkLlxuXG5pbXBvcnQgdHlwZSB7IE5ld3NJdGVtLCBQaXZvdE5ld3NSZXN1bHQsIFBpdm90UG9pbnQgfSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgc2VhcmNoR29vZ2xlTmV3cyB9IGZyb20gJy4vZ29vZ2xlTmV3cyc7XG5pbXBvcnQgeyBmZXRjaFN5bWJvbEZlZWQgfSBmcm9tICcuL25ld3MnO1xuaW1wb3J0IHsgbm9ybWFsaXplVGl0bGUsIHBMaW1pdCwgdG9ZbWQgfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBXSU5ET1dfREFZUyA9IDU7XG5jb25zdCBEQVlfTVMgPSA4Nl80MDBfMDAwO1xuY29uc3QgR09PR0xFX1RUTF9NUyA9IDMwICogNjBfMDAwOyAvLyBwZXIgc3ltYm9sK3Bpdm90LWRheSB3aW5kb3dcbmNvbnN0IE1BWF9JVEVNU19QRVJfUElWT1QgPSA0O1xuY29uc3QgTUFYX1BJVk9UUyA9IDEyO1xuY29uc3QgbGltaXQgPSBwTGltaXQoMyk7XG5cbmFzeW5jIGZ1bmN0aW9uIG5ld3NGb3JQaXZvdChcbiAgc3ltYm9sOiBzdHJpbmcsXG4gIHBpdm90OiBQaXZvdFBvaW50LFxuICB5YWhvb0l0ZW1zOiBOZXdzSXRlbVtdLFxuKTogUHJvbWlzZTxOZXdzSXRlbVtdPiB7XG4gIGNvbnN0IHBpdm90TXMgPSBwaXZvdC50aW1lICogMTAwMDtcbiAgY29uc3Qgc3RhcnRNcyA9IHBpdm90TXMgLSBXSU5ET1dfREFZUyAqIERBWV9NUztcbiAgbGV0IGVuZE1zID0gcGl2b3RNcyArIFdJTkRPV19EQVlTICogREFZX01TO1xuICBjb25zdCBub3dNcyA9IERhdGUubm93KCk7XG4gIGlmIChlbmRNcyA+IG5vd01zKSBlbmRNcyA9IG5vd01zOyAvLyBjbGFtcCAnYmVmb3JlJyB0byB0b2RheVxuICBjb25zdCBhZnRlclltZCA9IHRvWW1kKG5ldyBEYXRlKE1hdGgubWluKHN0YXJ0TXMsIGVuZE1zIC0gREFZX01TKSkpO1xuICBjb25zdCBiZWZvcmVZbWQgPSB0b1ltZChuZXcgRGF0ZShlbmRNcykpO1xuXG4gIGNvbnN0IGdvb2dsZSA9IGF3YWl0IHNlYXJjaEdvb2dsZU5ld3Moc3ltYm9sLCBhZnRlclltZCwgYmVmb3JlWW1kLCBHT09HTEVfVFRMX01TKS5jYXRjaChcbiAgICAoKSA9PiBbXSBhcyBOZXdzSXRlbVtdLFxuICApO1xuXG4gIGNvbnN0IGluV2luZG93ID0gKGl0ZW06IE5ld3NJdGVtKTogYm9vbGVhbiA9PiB7XG4gICAgY29uc3QgbXMgPSBEYXRlLnBhcnNlKGl0ZW0ucHVibGlzaGVkQXQpO1xuICAgIHJldHVybiAhTnVtYmVyLmlzTmFOKG1zKSAmJiBtcyA+PSBzdGFydE1zIC0gREFZX01TICYmIG1zIDw9IGVuZE1zICsgREFZX01TO1xuICB9O1xuXG4gIGNvbnN0IG1lcmdlZDogTmV3c0l0ZW1bXSA9IFtdO1xuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGZvciAoY29uc3QgaXRlbSBvZiBbLi4uZ29vZ2xlLCAuLi55YWhvb0l0ZW1zLmZpbHRlcihpbldpbmRvdyldKSB7XG4gICAgY29uc3Qga2V5ID0gbm9ybWFsaXplVGl0bGUoaXRlbS50aXRsZSk7XG4gICAgaWYgKCFrZXkgfHwgc2Vlbi5oYXMoa2V5KSkgY29udGludWU7XG4gICAgc2Vlbi5hZGQoa2V5KTtcbiAgICBtZXJnZWQucHVzaChpdGVtKTtcbiAgfVxuXG4gIG1lcmdlZC5zb3J0KFxuICAgIChhLCBiKSA9PlxuICAgICAgTWF0aC5hYnMoRGF0ZS5wYXJzZShhLnB1Ymxpc2hlZEF0KSAtIHBpdm90TXMpIC1cbiAgICAgIE1hdGguYWJzKERhdGUucGFyc2UoYi5wdWJsaXNoZWRBdCkgLSBwaXZvdE1zKSxcbiAgKTtcbiAgcmV0dXJuIG1lcmdlZC5zbGljZSgwLCBNQVhfSVRFTVNfUEVSX1BJVk9UKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFBpdm90TmV3cyhcbiAgc3ltYm9sOiBzdHJpbmcsXG4gIHBpdm90czogUGl2b3RQb2ludFtdLFxuKTogUHJvbWlzZTxQaXZvdE5ld3NSZXN1bHRbXT4ge1xuICBjb25zdCBib3VuZGVkID0gcGl2b3RzLnNsaWNlKDAsIE1BWF9QSVZPVFMpO1xuICBpZiAoYm91bmRlZC5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblxuICAvLyBGZXRjaCB0aGUgc3ltYm9sJ3MgWWFob28gZmVlZCBvbmNlIGZvciB0aGUgd2hvbGUgYmF0Y2g7IGEgZmFpbHVyZSBoZXJlXG4gIC8vIGp1c3QgbWVhbnMgcGl2b3Qgd2luZG93cyByZWx5IG9uIEdvb2dsZSBOZXdzIGFsb25lLlxuICBjb25zdCB5YWhvb0l0ZW1zID0gYXdhaXQgZmV0Y2hTeW1ib2xGZWVkKHN5bWJvbCkuY2F0Y2goKCkgPT4gW10gYXMgTmV3c0l0ZW1bXSk7XG5cbiAgY29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKFxuICAgIGJvdW5kZWQubWFwKChwaXZvdCkgPT5cbiAgICAgIGxpbWl0KCgpID0+IG5ld3NGb3JQaXZvdChzeW1ib2wsIHBpdm90LCB5YWhvb0l0ZW1zKSlcbiAgICAgICAgLmNhdGNoKCgpID0+IFtdIGFzIE5ld3NJdGVtW10pXG4gICAgICAgIC50aGVuKChpdGVtcyk6IFBpdm90TmV3c1Jlc3VsdCA9PiAoeyBwaXZvdCwgaXRlbXMgfSkpLFxuICAgICksXG4gICk7XG4gIHJldHVybiByZXN1bHRzOyAvLyBQcm9taXNlLmFsbCBwcmVzZXJ2ZXMgaW5wdXQgb3JkZXJcbn1cbiIsICIvLyBxdW90ZXM6Z2V0IFx1MjAxNCBsaXZlIHF1b3RlcyBkZXJpdmVkIGZyb20gdGhlIHY4IGNoYXJ0IGVuZHBvaW50ICgxZC81bSksXG4vLyB3aGljaCBuZWVkcyBubyBhdXRoLiBPbmUgUXVvdGUgaXMgYWx3YXlzIHJldHVybmVkIHBlciByZXF1ZXN0ZWQgc3ltYm9sO1xuLy8gcGVyLXN5bWJvbCBmYWlsdXJlcyBmYWxsIGJhY2sgdG8gZGV0ZXJtaW5pc3RpYyBzYW1wbGUgcXVvdGVzLlxuXG5pbXBvcnQgdHlwZSB7IFF1b3RlIH0gZnJvbSAnLi4vLi4vc2hhcmVkL3R5cGVzJztcbmltcG9ydCB7IHNhbXBsZVF1b3RlIH0gZnJvbSAnLi9zYW1wbGUnO1xuaW1wb3J0IHsgcExpbWl0LCByb3VuZDIgfSBmcm9tICcuL3V0aWwnO1xuaW1wb3J0IHsgZmV0Y2hZYWhvb0NoYXJ0IH0gZnJvbSAnLi95YWhvbyc7XG5cbmNvbnN0IFFVT1RFX1RUTF9NUyA9IDQ1XzAwMDtcbmNvbnN0IGxpbWl0ID0gcExpbWl0KDQpO1xuXG5hc3luYyBmdW5jdGlvbiBmZXRjaFF1b3RlKHN5bWJvbDogc3RyaW5nKTogUHJvbWlzZTxRdW90ZT4ge1xuICBjb25zdCByZXN1bHQgPSBhd2FpdCBmZXRjaFlhaG9vQ2hhcnQoc3ltYm9sLCAnMWQnLCAnNW0nLCBRVU9URV9UVExfTVMpO1xuICBjb25zdCBtZXRhID0gcmVzdWx0Lm1ldGEgPz8ge307XG5cbiAgY29uc3QgcHJpY2UgPVxuICAgIHR5cGVvZiBtZXRhLnJlZ3VsYXJNYXJrZXRQcmljZSA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKG1ldGEucmVndWxhck1hcmtldFByaWNlKVxuICAgICAgPyBtZXRhLnJlZ3VsYXJNYXJrZXRQcmljZVxuICAgICAgOiBudWxsO1xuICBjb25zdCBwcmV2UmF3ID0gbWV0YS5jaGFydFByZXZpb3VzQ2xvc2UgPz8gbWV0YS5wcmV2aW91c0Nsb3NlO1xuICBjb25zdCBwcmV2aW91c0Nsb3NlID1cbiAgICB0eXBlb2YgcHJldlJhdyA9PT0gJ251bWJlcicgJiYgTnVtYmVyLmlzRmluaXRlKHByZXZSYXcpID8gcHJldlJhdyA6IG51bGw7XG5cbiAgbGV0IGNoYW5nZTogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gIGxldCBjaGFuZ2VQZXJjZW50OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgaWYgKHByaWNlICE9PSBudWxsICYmIHByZXZpb3VzQ2xvc2UgIT09IG51bGwpIHtcbiAgICBjaGFuZ2UgPSByb3VuZDIocHJpY2UgLSBwcmV2aW91c0Nsb3NlKTtcbiAgICBjaGFuZ2VQZXJjZW50ID0gcHJldmlvdXNDbG9zZSAhPT0gMCA/IHJvdW5kMigoY2hhbmdlIC8gcHJldmlvdXNDbG9zZSkgKiAxMDApIDogbnVsbDtcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgc3ltYm9sLFxuICAgIHByaWNlLFxuICAgIGNoYW5nZSxcbiAgICBjaGFuZ2VQZXJjZW50LFxuICAgIHByZXZpb3VzQ2xvc2UsXG4gICAgY3VycmVuY3k6IHR5cGVvZiBtZXRhLmN1cnJlbmN5ID09PSAnc3RyaW5nJyAmJiBtZXRhLmN1cnJlbmN5ID8gbWV0YS5jdXJyZW5jeSA6ICdVU0QnLFxuICAgIG1hcmtldFN0YXRlOlxuICAgICAgdHlwZW9mIG1ldGEubWFya2V0U3RhdGUgPT09ICdzdHJpbmcnICYmIG1ldGEubWFya2V0U3RhdGUgPyBtZXRhLm1hcmtldFN0YXRlIDogdW5kZWZpbmVkLFxuICAgIHVwZGF0ZWRBdDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxuICAgIHNvdXJjZTogJ2xpdmUnLFxuICB9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0UXVvdGVzKHN5bWJvbHM6IHN0cmluZ1tdKTogUHJvbWlzZTxRdW90ZVtdPiB7XG4gIHJldHVybiBQcm9taXNlLmFsbChcbiAgICBzeW1ib2xzLm1hcCgoc3ltYm9sKSA9PlxuICAgICAgbGltaXQoKCkgPT4gZmV0Y2hRdW90ZShzeW1ib2wpKS5jYXRjaCgoKSA9PiBzYW1wbGVRdW90ZShzeW1ib2wpKSxcbiAgICApLFxuICApO1xufVxuIiwgIi8vIHN5bWJvbHM6c2VhcmNoIFx1MjAxNCBZYWhvbyBzeW1ib2wgc2VhcmNoIG1hcHBlZCB0byBTeW1ib2xTdWdnZXN0aW9uW10sIHdpdGggYW5cbi8vIG9mZmxpbmUgZmFsbGJhY2sgdGhhdCBmaWx0ZXJzIHRoZSBidW5kbGVkIHN5bWJvbCBkaXJlY3RvcnkuXG5cbmltcG9ydCB0eXBlIHsgSW5zdHJ1bWVudFR5cGUsIFN5bWJvbFN1Z2dlc3Rpb24gfSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgZ2V0U3ltYm9sRGlyZWN0b3J5IH0gZnJvbSAnLi9kYXRhRmlsZXMnO1xuaW1wb3J0IHsgc2VhcmNoWWFob28gfSBmcm9tICcuL3lhaG9vJztcblxuY29uc3QgTUFYX1JFU1VMVFMgPSA4O1xuXG5mdW5jdGlvbiBtYXBRdW90ZVR5cGUocXVvdGVUeXBlOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBJbnN0cnVtZW50VHlwZSB8IG51bGwge1xuICBjb25zdCB0ID0gKHF1b3RlVHlwZSA/PyAnJykudG9VcHBlckNhc2UoKTtcbiAgaWYgKHQgPT09ICdFVEYnKSByZXR1cm4gJ2V0Zic7XG4gIGlmICh0ID09PSAnRVFVSVRZJykgcmV0dXJuICdzdG9jayc7XG4gIHJldHVybiBudWxsO1xufVxuXG4vKiogRmlsdGVyIHRoZSBidW5kbGVkIGRpcmVjdG9yeTogZXhhY3Qgc3ltYm9sLCB0aGVuIHN5bWJvbCBwcmVmaXgsIHRoZW4gbmFtZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZWFyY2hEaXJlY3RvcnkocXVlcnk6IHN0cmluZyk6IFN5bWJvbFN1Z2dlc3Rpb25bXSB7XG4gIGNvbnN0IHEgPSBxdWVyeS50cmltKCkudG9VcHBlckNhc2UoKTtcbiAgaWYgKCFxKSByZXR1cm4gW107XG4gIGNvbnN0IHFMb3dlciA9IHF1ZXJ5LnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICBjb25zdCBkaXIgPSBnZXRTeW1ib2xEaXJlY3RvcnkoKTtcblxuICBjb25zdCBzY29yZWQgPSBkaXJcbiAgICAubWFwKChlbnRyeSkgPT4ge1xuICAgICAgbGV0IHNjb3JlID0gLTE7XG4gICAgICBpZiAoZW50cnkuc3ltYm9sID09PSBxKSBzY29yZSA9IDM7XG4gICAgICBlbHNlIGlmIChlbnRyeS5zeW1ib2wuc3RhcnRzV2l0aChxKSkgc2NvcmUgPSAyO1xuICAgICAgZWxzZSBpZiAoZW50cnkubmFtZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKHFMb3dlcikpIHNjb3JlID0gMTtcbiAgICAgIHJldHVybiB7IGVudHJ5LCBzY29yZSB9O1xuICAgIH0pXG4gICAgLmZpbHRlcigocykgPT4gcy5zY29yZSA+IDApXG4gICAgLnNvcnQoKGEsIGIpID0+IGIuc2NvcmUgLSBhLnNjb3JlIHx8IGEuZW50cnkuc3ltYm9sLmxvY2FsZUNvbXBhcmUoYi5lbnRyeS5zeW1ib2wpKTtcblxuICByZXR1cm4gc2NvcmVkLnNsaWNlKDAsIE1BWF9SRVNVTFRTKS5tYXAoKHsgZW50cnkgfSkgPT4gKHtcbiAgICBzeW1ib2w6IGVudHJ5LnN5bWJvbCxcbiAgICBuYW1lOiBlbnRyeS5uYW1lLFxuICAgIHR5cGU6IGVudHJ5LnR5cGUsXG4gICAgZXhjaGFuZ2U6IGVudHJ5LmV4Y2hhbmdlLFxuICB9KSk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZWFyY2hTeW1ib2xzKHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPFN5bWJvbFN1Z2dlc3Rpb25bXT4ge1xuICBjb25zdCBxID0gcXVlcnkudHJpbSgpLnNsaWNlKDAsIDQ4KTtcbiAgaWYgKCFxKSByZXR1cm4gW107XG4gIHRyeSB7XG4gICAgY29uc3QgcXVvdGVzID0gYXdhaXQgc2VhcmNoWWFob28ocSk7XG4gICAgY29uc3Qgb3V0OiBTeW1ib2xTdWdnZXN0aW9uW10gPSBbXTtcbiAgICBmb3IgKGNvbnN0IHF1b3RlIG9mIHF1b3Rlcykge1xuICAgICAgY29uc3QgdHlwZSA9IG1hcFF1b3RlVHlwZShxdW90ZS5xdW90ZVR5cGUpO1xuICAgICAgaWYgKCF0eXBlKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IHN5bWJvbCA9IHR5cGVvZiBxdW90ZS5zeW1ib2wgPT09ICdzdHJpbmcnID8gcXVvdGUuc3ltYm9sLnRvVXBwZXJDYXNlKCkgOiAnJztcbiAgICAgIGlmICghc3ltYm9sIHx8IG91dC5zb21lKChzKSA9PiBzLnN5bWJvbCA9PT0gc3ltYm9sKSkgY29udGludWU7XG4gICAgICBvdXQucHVzaCh7XG4gICAgICAgIHN5bWJvbCxcbiAgICAgICAgbmFtZTogcXVvdGUubG9uZ25hbWUgfHwgcXVvdGUuc2hvcnRuYW1lIHx8IHN5bWJvbCxcbiAgICAgICAgdHlwZSxcbiAgICAgICAgZXhjaGFuZ2U6IHF1b3RlLmV4Y2hEaXNwIHx8IHVuZGVmaW5lZCxcbiAgICAgIH0pO1xuICAgICAgaWYgKG91dC5sZW5ndGggPj0gTUFYX1JFU1VMVFMpIGJyZWFrO1xuICAgIH1cbiAgICAvLyBMaXZlIHNlYXJjaCBjYW4gbGVnaXRpbWF0ZWx5IHJldHVybiBub3RoaW5nOyBvbmx5IGZhbGwgYmFjayB0byB0aGVcbiAgICAvLyBvZmZsaW5lIGRpcmVjdG9yeSB3aGVuIFlhaG9vIGdhdmUgdXMgbm90aGluZyB1c2FibGUgYXQgYWxsLlxuICAgIHJldHVybiBvdXQubGVuZ3RoID4gMCA/IG91dCA6IHNlYXJjaERpcmVjdG9yeShxKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHNlYXJjaERpcmVjdG9yeShxKTtcbiAgfVxufVxuIiwgIi8vIFBlcnNpc3RlbnQgd2F0Y2hsaXN0OiBKU09OIGZpbGUgaW4gdXNlckRhdGEsIHNlZWRlZCBvbiBmaXJzdCBydW4uXG4vLyBBIGNvcnJ1cHQgZmlsZSBpcyByZXBsYWNlZCB3aXRoIHRoZSBzZWVkIHJhdGhlciB0aGFuIGNyYXNoaW5nLlxuXG5pbXBvcnQgeyBhcHAgfSBmcm9tICdlbGVjdHJvbic7XG5pbXBvcnQgZnMgZnJvbSAnbm9kZTpmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnO1xuaW1wb3J0IHR5cGUge1xuICBBZGRXYXRjaGxpc3RSZXN1bHQsXG4gIEluc3RydW1lbnRUeXBlLFxuICBXYXRjaGxpc3RJdGVtLFxufSBmcm9tICcuLi8uLi9zaGFyZWQvdHlwZXMnO1xuaW1wb3J0IHsgZGlyZWN0b3J5TG9va3VwIH0gZnJvbSAnLi9kYXRhRmlsZXMnO1xuaW1wb3J0IHsgc2VhcmNoU3ltYm9scyB9IGZyb20gJy4vc3ltYm9scyc7XG5pbXBvcnQgeyBub3JtYWxpemVTeW1ib2wgfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBTRUVEOiBBcnJheTx7IHN5bWJvbDogc3RyaW5nOyBuYW1lOiBzdHJpbmc7IHR5cGU6IEluc3RydW1lbnRUeXBlIH0+ID0gW1xuICB7IHN5bWJvbDogJ1NQWScsIG5hbWU6ICdTUERSIFMmUCA1MDAgRVRGIFRydXN0JywgdHlwZTogJ2V0ZicgfSxcbiAgeyBzeW1ib2w6ICdRUVEnLCBuYW1lOiAnSW52ZXNjbyBRUVEgVHJ1c3QnLCB0eXBlOiAnZXRmJyB9LFxuICB7IHN5bWJvbDogJ1NNSCcsIG5hbWU6ICdWYW5FY2sgU2VtaWNvbmR1Y3RvciBFVEYnLCB0eXBlOiAnZXRmJyB9LFxuICB7IHN5bWJvbDogJ0FBUEwnLCBuYW1lOiAnQXBwbGUgSW5jLicsIHR5cGU6ICdzdG9jaycgfSxcbiAgeyBzeW1ib2w6ICdOVkRBJywgbmFtZTogJ05WSURJQSBDb3Jwb3JhdGlvbicsIHR5cGU6ICdzdG9jaycgfSxcbiAgeyBzeW1ib2w6ICdUU0xBJywgbmFtZTogJ1Rlc2xhLCBJbmMuJywgdHlwZTogJ3N0b2NrJyB9LFxuXTtcblxubGV0IGl0ZW1zOiBXYXRjaGxpc3RJdGVtW10gfCBudWxsID0gbnVsbDtcblxuZnVuY3Rpb24gc3RvcmVQYXRoKCk6IHN0cmluZyB7XG4gIHJldHVybiBwYXRoLmpvaW4oYXBwLmdldFBhdGgoJ3VzZXJEYXRhJyksICd3YXRjaGxpc3QuanNvbicpO1xufVxuXG5mdW5jdGlvbiBzZWVkSXRlbXMoKTogV2F0Y2hsaXN0SXRlbVtdIHtcbiAgY29uc3QgYWRkZWRBdCA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcbiAgcmV0dXJuIFNFRUQubWFwKChzKSA9PiAoeyAuLi5zLCBhZGRlZEF0IH0pKTtcbn1cblxuZnVuY3Rpb24gaXNWYWxpZEl0ZW0odmFsdWU6IHVua25vd24pOiB2YWx1ZSBpcyBXYXRjaGxpc3RJdGVtIHtcbiAgaWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSByZXR1cm4gZmFsc2U7XG4gIGNvbnN0IGl0ZW0gPSB2YWx1ZSBhcyBQYXJ0aWFsPFdhdGNobGlzdEl0ZW0+O1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBpdGVtLnN5bWJvbCA9PT0gJ3N0cmluZycgJiZcbiAgICBub3JtYWxpemVTeW1ib2woaXRlbS5zeW1ib2wpICE9PSBudWxsICYmXG4gICAgdHlwZW9mIGl0ZW0ubmFtZSA9PT0gJ3N0cmluZycgJiZcbiAgICBpdGVtLm5hbWUubGVuZ3RoID4gMCAmJlxuICAgIChpdGVtLnR5cGUgPT09ICdldGYnIHx8IGl0ZW0udHlwZSA9PT0gJ3N0b2NrJykgJiZcbiAgICB0eXBlb2YgaXRlbS5hZGRlZEF0ID09PSAnc3RyaW5nJ1xuICApO1xufVxuXG5mdW5jdGlvbiBzYXZlKGxpc3Q6IFdhdGNobGlzdEl0ZW1bXSk6IHZvaWQge1xuICB0cnkge1xuICAgIGNvbnN0IGZpbGUgPSBzdG9yZVBhdGgoKTtcbiAgICBmcy5ta2RpclN5bmMocGF0aC5kaXJuYW1lKGZpbGUpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcbiAgICBmcy53cml0ZUZpbGVTeW5jKGZpbGUsIEpTT04uc3RyaW5naWZ5KGxpc3QsIG51bGwsIDIpLCAndXRmOCcpO1xuICB9IGNhdGNoIChlcnIpIHtcbiAgICBjb25zb2xlLmVycm9yKCdbd2F0Y2hsaXN0XSBmYWlsZWQgdG8gcGVyc2lzdDonLCBlcnIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGxvYWQoKTogV2F0Y2hsaXN0SXRlbVtdIHtcbiAgaWYgKGl0ZW1zKSByZXR1cm4gaXRlbXM7XG4gIHRyeSB7XG4gICAgY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKHN0b3JlUGF0aCgpLCAndXRmOCcpO1xuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3KSBhcyB1bmtub3duO1xuICAgIGlmIChBcnJheS5pc0FycmF5KHBhcnNlZCkpIHtcbiAgICAgIGNvbnN0IHZhbGlkID0gcGFyc2VkLmZpbHRlcihpc1ZhbGlkSXRlbSkubWFwKChpdGVtKSA9PiAoe1xuICAgICAgICAuLi5pdGVtLFxuICAgICAgICBzeW1ib2w6IGl0ZW0uc3ltYm9sLnRvVXBwZXJDYXNlKCksXG4gICAgICB9KSk7XG4gICAgICBpZiAodmFsaWQubGVuZ3RoID4gMCB8fCBwYXJzZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGl0ZW1zID0gdmFsaWQ7XG4gICAgICAgIHJldHVybiBpdGVtcztcbiAgICAgIH1cbiAgICB9XG4gICAgdGhyb3cgbmV3IEVycm9yKCd1bnJlY29nbml6ZWQgd2F0Y2hsaXN0IGZpbGUgc2hhcGUnKTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc3QgY29kZSA9IChlcnIgYXMgTm9kZUpTLkVycm5vRXhjZXB0aW9uKS5jb2RlO1xuICAgIGlmIChjb2RlICE9PSAnRU5PRU5UJykgY29uc29sZS5lcnJvcignW3dhdGNobGlzdF0gcmVzZWVkaW5nIGFmdGVyIGxvYWQgZXJyb3I6JywgZXJyKTtcbiAgICBpdGVtcyA9IHNlZWRJdGVtcygpO1xuICAgIHNhdmUoaXRlbXMpO1xuICAgIHJldHVybiBpdGVtcztcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0V2F0Y2hsaXN0KCk6IFdhdGNobGlzdEl0ZW1bXSB7XG4gIHJldHVybiBbLi4ubG9hZCgpXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZUZyb21XYXRjaGxpc3Qoc3ltYm9sOiBzdHJpbmcpOiBXYXRjaGxpc3RJdGVtW10ge1xuICBjb25zdCBzeW0gPSBzeW1ib2wudG9VcHBlckNhc2UoKTtcbiAgY29uc3QgbGlzdCA9IGxvYWQoKS5maWx0ZXIoKGl0ZW0pID0+IGl0ZW0uc3ltYm9sICE9PSBzeW0pO1xuICBpdGVtcyA9IGxpc3Q7XG4gIHNhdmUobGlzdCk7XG4gIHJldHVybiBbLi4ubGlzdF07XG59XG5cbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVTeW1ib2woXG4gIHN5bWJvbDogc3RyaW5nLFxuKTogUHJvbWlzZTx7IG5hbWU6IHN0cmluZzsgdHlwZTogSW5zdHJ1bWVudFR5cGUgfSB8IG51bGw+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdWdnZXN0aW9ucyA9IGF3YWl0IHNlYXJjaFN5bWJvbHMoc3ltYm9sKTtcbiAgICBjb25zdCBleGFjdCA9IHN1Z2dlc3Rpb25zLmZpbmQoKHMpID0+IHMuc3ltYm9sLnRvVXBwZXJDYXNlKCkgPT09IHN5bWJvbCk7XG4gICAgaWYgKGV4YWN0KSByZXR1cm4geyBuYW1lOiBleGFjdC5uYW1lLCB0eXBlOiBleGFjdC50eXBlIH07XG4gIH0gY2F0Y2gge1xuICAgIC8qIGZhbGwgdGhyb3VnaCB0byB0aGUgb2ZmbGluZSBkaXJlY3RvcnkgKi9cbiAgfVxuICBjb25zdCBlbnRyeSA9IGRpcmVjdG9yeUxvb2t1cChzeW1ib2wpO1xuICBpZiAoZW50cnkpIHJldHVybiB7IG5hbWU6IGVudHJ5Lm5hbWUsIHR5cGU6IGVudHJ5LnR5cGUgfTtcbiAgcmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBhZGRUb1dhdGNobGlzdChyYXdTeW1ib2w6IHN0cmluZyk6IFByb21pc2U8QWRkV2F0Y2hsaXN0UmVzdWx0PiB7XG4gIGNvbnN0IHN5bWJvbCA9IG5vcm1hbGl6ZVN5bWJvbChyYXdTeW1ib2wpO1xuICBpZiAoIXN5bWJvbCkgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ0ludmFsaWQgc3ltYm9sJyB9O1xuXG4gIGNvbnN0IGxpc3QgPSBsb2FkKCk7XG4gIGlmIChsaXN0LnNvbWUoKGl0ZW0pID0+IGl0ZW0uc3ltYm9sID09PSBzeW1ib2wpKSB7XG4gICAgcmV0dXJuIHsgb2s6IGZhbHNlLCBlcnJvcjogJ0FscmVhZHkgaW4gd2F0Y2hsaXN0JyB9O1xuICB9XG5cbiAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlU3ltYm9sKHN5bWJvbCk7XG4gIGlmICghcmVzb2x2ZWQpIHJldHVybiB7IG9rOiBmYWxzZSwgZXJyb3I6ICdTeW1ib2wgbm90IGZvdW5kJyB9O1xuXG4gIGNvbnN0IGl0ZW06IFdhdGNobGlzdEl0ZW0gPSB7XG4gICAgc3ltYm9sLFxuICAgIG5hbWU6IHJlc29sdmVkLm5hbWUsXG4gICAgdHlwZTogcmVzb2x2ZWQudHlwZSxcbiAgICBhZGRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG4gIH07XG4gIGNvbnN0IG5leHQgPSBbLi4ubGlzdCwgaXRlbV07XG4gIGl0ZW1zID0gbmV4dDtcbiAgc2F2ZShuZXh0KTtcbiAgcmV0dXJuIHsgb2s6IHRydWUsIGl0ZW0sIHdhdGNobGlzdDogWy4uLm5leHRdIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQSw2Q0FBQUEsVUFBQTtBQUFBO0FBRUEsUUFBTSxnQkFBZ0I7QUFDdEIsUUFBTSxXQUFXLGdCQUFnQjtBQUNqQyxRQUFNLGFBQWEsTUFBTSxnQkFBZ0IsT0FBTyxXQUFXO0FBQzNELFFBQU0sWUFBWSxJQUFJLE9BQU8sTUFBTSxhQUFhLEdBQUc7QUFFbkQsUUFBTSxnQkFBZ0IsU0FBVSxRQUFRLE9BQU87QUFDN0MsWUFBTSxVQUFVLENBQUM7QUFDakIsVUFBSSxRQUFRLE1BQU0sS0FBSyxNQUFNO0FBQzdCLGFBQU8sT0FBTztBQUNaLGNBQU0sYUFBYSxDQUFDO0FBQ3BCLG1CQUFXLGFBQWEsTUFBTSxZQUFZLE1BQU0sQ0FBQyxFQUFFO0FBQ25ELGNBQU0sTUFBTSxNQUFNO0FBQ2xCLGlCQUFTLFFBQVEsR0FBRyxRQUFRLEtBQUssU0FBUztBQUN4QyxxQkFBVyxLQUFLLE1BQU0sS0FBSyxDQUFDO0FBQUEsUUFDOUI7QUFDQSxnQkFBUSxLQUFLLFVBQVU7QUFDdkIsZ0JBQVEsTUFBTSxLQUFLLE1BQU07QUFBQSxNQUMzQjtBQUNB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O0FBQUEsRUFBSyxLQUFLO0FBQUEsRUFDakUsS0FBSztBQUFBLEVBQUssS0FBSztBQUFBLEVBQUksS0FBSztBQUFBLEVBQUksS0FBSztBQUFBLEVBQUssS0FBSztBQUFBLEVBQUssTUFBTTtBQUFBLEVBQUssTUFBTTtBQUFBLEVBQ2pFLE1BQU07QUFBQSxFQUFJLE1BQU07QUFBQSxFQUFJLEtBQUs7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUN2RCxNQUFNO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFBSyxPQUFPO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFDOUQsTUFBTTtBQUFBLEVBQUssTUFBTTtBQUFBLEVBQUssTUFBTTtBQUFBLEVBQUssU0FBUztBQUFBLEVBQUssS0FBSztBQUFBLEVBQUssR0FBRztBQUFBLEVBQzVELElBQUk7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLElBQUk7QUFBQSxFQUFLLElBQUk7QUFBQSxFQUM5RCxNQUFNO0FBQUEsRUFBSyxLQUFLO0FBQUEsRUFBSSxNQUFNO0FBQUEsRUFBTSxLQUFLO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFBSyxLQUFLO0FBQUEsRUFDMUQsTUFBTTtBQUFBLEVBQUssS0FBSztBQUFBLEVBQUssSUFBSTtBQUFBLEVBQUksTUFBTTtBQUFBLEVBQUksTUFBTTtBQUFBLEVBQUksS0FBSztBQUFBLEVBQUssTUFBTTtBQUFBLEVBQ2pFLE1BQU07QUFBQSxFQUFLLEtBQUs7QUFBQSxFQUFLLElBQUk7QUFBQSxFQUFLLE1BQU07QUFBQSxFQUFLLE1BQU07QUFBQSxFQUFJLE1BQU07QUFBQSxFQUN6RCxNQUFNO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFBSyxNQUFNO0FBQUEsRUFBSSxNQUFNO0FBQUEsRUFBSyxLQUFLO0FBQUEsRUFBSyxJQUFJO0FBQUEsRUFDekQsS0FBSztBQUFB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QUFXLFFBQVE7QUFDakQsaUJBQVcsTUFBTTtBQUFBLElBQ25CO0FBQUEsRUFDRixDQUFDO0FBRUQsVUFBUSxHQUFHLHNCQUFzQixDQUFDLFdBQVc7QUFDM0MsWUFBUSxNQUFNLCtCQUErQixNQUFNO0FBQUEsRUFDckQsQ0FBQztBQUVELHVCQUFJLFVBQVUsRUFBRSxLQUFLLE1BQU07QUFDekIsd0JBQW9CO0FBQ3BCLGlCQUFhO0FBRWIseUJBQUksR0FBRyxZQUFZLE1BQU07QUFDdkIsVUFBSSwrQkFBYyxjQUFjLEVBQUUsV0FBVyxFQUFHLGNBQWE7QUFBQSxJQUMvRCxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsdUJBQUksR0FBRyxxQkFBcUIsTUFBTTtBQUNoQyx5QkFBSSxLQUFLO0FBQUEsRUFDWCxDQUFDO0FBQ0g7IiwKICAibmFtZXMiOiBbImV4cG9ydHMiLCAiZXhwb3J0cyIsICJleHBvcnRzIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgInJlc3VsdCIsICJleHBvcnRzIiwgImV4cG9ydHMiLCAibW9kdWxlIiwgIlhNTFBhcnNlciIsICJleHBvcnRzIiwgIm1vZHVsZSIsICJhdHRTdHIiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAiZXhwb3J0cyIsICJtb2R1bGUiLCAiWE1MUGFyc2VyIiwgImltcG9ydF9lbGVjdHJvbiIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgInBhdGgiLCAiZnMiLCAiaXRlbXMiLCAiTElWRV9UVExfTVMiLCAiU0FNUExFX1RUTF9NUyIsICJjYWNoZSIsICJpbkZsaWdodCIsICJsaW1pdCIsICJpdGVtcyIsICJpdGVtcyIsICJXSU5ET1dfREFZUyIsICJsaW1pdCIsICJpdGVtcyIsICJsaW1pdCIsICJpbXBvcnRfbm9kZV9mcyIsICJpbXBvcnRfbm9kZV9wYXRoIiwgInBhdGgiLCAiZnMiLCAiaXRlbSIsICJNQVhfUElWT1RTIiwgInBhdGgiLCAiZnMiXQp9Cg==
