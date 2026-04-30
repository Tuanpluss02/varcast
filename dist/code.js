"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/reader/variables.ts
  async function readVariables() {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();
    return collections.map((col) => {
      const colVars = variables.filter((v) => v.variableCollectionId === col.id);
      const modes = col.modes.map((m) => ({
        id: m.modeId,
        name: m.name,
        dartName: m.name
      }));
      const irVars = colVars.map((v) => {
        var _a;
        const valuesByMode = {};
        for (const mode of modes) {
          const raw = v.valuesByMode[mode.id];
          valuesByMode[mode.id] = buildValue(raw);
        }
        return {
          id: v.id,
          figmaName: v.name,
          dartName: v.name,
          groupPath: v.name.split("/").map((s) => s.trim()),
          type: v.resolvedType,
          scopes: (_a = v.scopes) != null ? _a : [],
          hiddenFromPublishing: v.hiddenFromPublishing,
          emitToPublic: !v.hiddenFromPublishing,
          valuesByMode
        };
      });
      const hasAlias = irVars.some(
        (v) => Object.values(v.valuesByMode).some((val) => val.kind === "alias")
      );
      return {
        id: col.id,
        name: col.name,
        dartName: col.name,
        kind: hasAlias ? "token" : "primitive",
        modes,
        variables: irVars
      };
    });
  }
  function buildValue(raw) {
    if (raw !== null && typeof raw === "object" && "type" in raw && raw.type === "VARIABLE_ALIAS") {
      return {
        kind: "alias",
        targetVariableId: raw.id
      };
    }
    return { kind: "literal", value: raw };
  }

  // src/reader/paint_styles.ts
  async function readPaintStyles() {
    const styles = await figma.getLocalPaintStylesAsync();
    const out = [];
    for (const style of styles) {
      const built = buildPaintStyle(style);
      if (built)
        out.push(built);
    }
    return out;
  }
  function buildPaintStyle(style) {
    const fill = style.paints[0];
    if (!fill)
      return null;
    const base = {
      id: style.id,
      figmaName: style.name,
      dartName: style.name,
      groupPath: style.name.split("/").map((s) => s.trim())
    };
    switch (fill.type) {
      case "SOLID":
        return __spreadProps(__spreadValues({}, base), {
          type: "SOLID",
          color: solidColorValue(fill)
        });
      case "GRADIENT_LINEAR":
        return __spreadProps(__spreadValues({}, base), {
          type: "GRADIENT_LINEAR",
          angleRadians: extractLinearAngle(fill.gradientTransform),
          stops: fill.gradientStops.map(buildStop)
        });
      case "GRADIENT_RADIAL":
        return __spreadProps(__spreadValues({}, base), {
          type: "GRADIENT_RADIAL",
          center: { x: 0.5, y: 0.5 },
          radius: 0.5,
          stops: fill.gradientStops.map(buildStop)
        });
      case "GRADIENT_ANGULAR":
        return __spreadProps(__spreadValues({}, base), {
          type: "GRADIENT_ANGULAR",
          startAngle: 0,
          endAngle: 2 * Math.PI,
          stops: fill.gradientStops.map(buildStop)
        });
      case "GRADIENT_DIAMOND":
        return __spreadProps(__spreadValues({}, base), {
          type: "GRADIENT_DIAMOND",
          stops: fill.gradientStops.map(buildStop),
          note: "approximated_as_radial"
        });
      case "IMAGE":
        return __spreadProps(__spreadValues({}, base), {
          type: "IMAGE",
          assetName: imageAssetName(style.name)
        });
      default:
        return null;
    }
  }
  function buildStop(stop) {
    var _a;
    const binding = (_a = stop.boundVariables) == null ? void 0 : _a["color"];
    return {
      position: stop.position,
      color: binding ? { kind: "alias", targetVariableId: binding.id } : { kind: "literal", rgba: toRGBA(stop.color) }
    };
  }
  function solidColorValue(fill) {
    var _a, _b;
    const binding = (_a = fill.boundVariables) == null ? void 0 : _a["color"];
    if (binding) {
      return { kind: "alias", targetVariableId: binding.id };
    }
    const opacity = (_b = fill.opacity) != null ? _b : 1;
    return {
      kind: "literal",
      rgba: { r: fill.color.r, g: fill.color.g, b: fill.color.b, a: opacity }
    };
  }
  function toRGBA(c) {
    return { r: c.r, g: c.g, b: c.b, a: "a" in c ? c.a : 1 };
  }
  function imageAssetName(figmaName) {
    return figmaName.replace(/\//g, "_").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() + ".jpg";
  }
  function extractLinearAngle(t) {
    const dx = t[0][0];
    const dy = t[1][0];
    return Math.atan2(dx, -dy);
  }

  // src/reader/effect_styles.ts
  async function readEffectStyles() {
    const styles = await figma.getLocalEffectStylesAsync();
    const out = [];
    for (const style of styles) {
      for (const effect of style.effects) {
        const built = buildEffect(style, effect);
        if (built)
          out.push(built);
      }
    }
    return out;
  }
  function buildEffect(style, effect) {
    var _a, _b;
    const base = {
      id: style.id,
      figmaName: style.name,
      dartName: style.name,
      groupPath: style.name.split("/").map((s) => s.trim())
    };
    switch (effect.type) {
      case "DROP_SHADOW": {
        const e = effect;
        return __spreadProps(__spreadValues({}, base), {
          type: "DROP_SHADOW",
          color: shadowColor(e),
          offsetX: e.offset.x,
          offsetY: e.offset.y,
          blurRadius: e.radius,
          spreadRadius: (_a = e.spread) != null ? _a : 0
        });
      }
      case "INNER_SHADOW": {
        const e = effect;
        return __spreadProps(__spreadValues({}, base), {
          type: "INNER_SHADOW",
          color: shadowColor(e),
          offsetX: e.offset.x,
          offsetY: e.offset.y,
          blurRadius: e.radius,
          spreadRadius: (_b = e.spread) != null ? _b : 0
        });
      }
      case "LAYER_BLUR":
        return __spreadProps(__spreadValues({}, base), {
          type: "LAYER_BLUR",
          sigmaX: effect.radius,
          sigmaY: effect.radius
        });
      case "BACKGROUND_BLUR":
        return __spreadProps(__spreadValues({}, base), {
          type: "BACKGROUND_BLUR",
          sigmaX: effect.radius,
          sigmaY: effect.radius
        });
      default:
        return null;
    }
  }
  function shadowColor(e) {
    var _a;
    const binding = (_a = e.boundVariables) == null ? void 0 : _a["color"];
    if (binding) {
      return { kind: "alias", targetVariableId: binding.id };
    }
    return { kind: "literal", rgba: e.color };
  }

  // src/reader/text_styles.ts
  async function readTextStyles() {
    const styles = await figma.getLocalTextStylesAsync();
    return styles.map(buildTextStyle);
  }
  function buildTextStyle(style) {
    var _a;
    const bv = (_a = style.boundVariables) != null ? _a : {};
    const lh = style.lineHeight;
    const lineHeight = bv["lineHeight"] ? { kind: "alias", targetVariableId: bv["lineHeight"].id } : lh.unit === "AUTO" ? { kind: "literal", value: 0, unit: "AUTO" } : { kind: "literal", value: lh.value, unit: lh.unit };
    const ls = style.letterSpacing;
    const letterSpacing = bv["letterSpacing"] ? { kind: "alias", targetVariableId: bv["letterSpacing"].id } : { kind: "literal", value: ls.value, unit: ls.unit };
    return {
      id: style.id,
      figmaName: style.name,
      dartName: style.name,
      groupPath: style.name.split("/").map((s) => s.trim()),
      fontFamily: textVal(bv, "fontFamily", style.fontName.family),
      fontSize: textVal(bv, "fontSize", style.fontSize),
      fontWeight: textVal(bv, "fontWeight", style.fontName.style ? styleNameToWeight(style.fontName.style) : 400),
      lineHeight,
      letterSpacing
    };
  }
  function textVal(bv, key, fallback) {
    return bv[key] ? { kind: "alias", targetVariableId: bv[key].id } : { kind: "literal", value: fallback };
  }
  var STYLE_WEIGHT_MAP = {
    thin: 100,
    hairline: 100,
    extralight: 200,
    ultralight: 200,
    light: 300,
    regular: 400,
    normal: 400,
    book: 400,
    medium: 500,
    semibold: 600,
    demibold: 600,
    bold: 700,
    extrabold: 800,
    ultrabold: 800,
    black: 900,
    heavy: 900
  };
  function styleNameToWeight(name) {
    const key = name.replace(/\s+/g, "").toLowerCase();
    for (const [token, weight] of Object.entries(STYLE_WEIGHT_MAP)) {
      if (key.includes(token))
        return weight;
    }
    return 400;
  }

  // src/conventions/dart_keywords.ts
  var DART_KEYWORDS = /* @__PURE__ */ new Set([
    "abstract",
    "as",
    "assert",
    "async",
    "await",
    "base",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "covariant",
    "default",
    "deferred",
    "do",
    "dynamic",
    "else",
    "enum",
    "export",
    "extends",
    "extension",
    "external",
    "factory",
    "false",
    "final",
    "finally",
    "for",
    "function",
    "get",
    "hide",
    "if",
    "implements",
    "import",
    "in",
    "interface",
    "is",
    "late",
    "library",
    "mixin",
    "new",
    "null",
    "of",
    "on",
    "operator",
    "part",
    "required",
    "rethrow",
    "return",
    "sealed",
    "set",
    "show",
    "static",
    "super",
    "switch",
    "sync",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "typedef",
    "var",
    "void",
    "when",
    "while",
    "with",
    "yield"
  ]);

  // src/ir/validate.ts
  function validate(ir) {
    const errors = [];
    const warnings = [];
    const allVars = /* @__PURE__ */ new Map();
    for (const col of ir.collections) {
      for (const v of col.variables) {
        allVars.set(v.id, v);
      }
    }
    for (const col of ir.collections) {
      detectCycles(col, allVars, errors);
      resolveAliases(col, allVars, warnings);
      fixKeywords(col, warnings);
      fixDuplicates(col, warnings);
      roundFloats(col);
      applyHidden(col);
    }
    for (const style of ir.composites.paintStyles) {
      if (style.type === "GRADIENT_DIAMOND") {
        warnings.push({ type: "DIAMOND_APPROXIMATED", styleId: style.id });
      }
      if (style.type === "IMAGE") {
        warnings.push({
          type: "IMAGE_ASSET_REQUIRED",
          styleId: style.id,
          assetName: style.assetName
        });
      }
    }
    return { errors, warnings };
  }
  function detectCycles(col, allVars, errors) {
    const reported = /* @__PURE__ */ new Set();
    for (const v of col.variables) {
      const cycle = findCycle(v.id, allVars);
      if (!cycle)
        continue;
      const key = canonicalCycleKey(cycle);
      if (reported.has(key))
        continue;
      reported.add(key);
      errors.push({ type: "CYCLE", path: cycle });
    }
  }
  function findCycle(startId, allVars) {
    const stack = [
      { id: startId, path: [] }
    ];
    while (stack.length > 0) {
      const { id, path } = stack.pop();
      if (path.includes(id)) {
        const start = path.indexOf(id);
        return [...path.slice(start), id];
      }
      const v = allVars.get(id);
      if (!v)
        continue;
      const nextPath = [...path, id];
      for (const val of Object.values(v.valuesByMode)) {
        if (val.kind === "alias") {
          stack.push({ id: val.targetVariableId, path: nextPath });
        }
      }
    }
    return null;
  }
  function canonicalCycleKey(cycle) {
    const verts = cycle.slice(0, -1);
    let minIdx = 0;
    for (let i = 1; i < verts.length; i++) {
      if (verts[i] < verts[minIdx])
        minIdx = i;
    }
    const rotated = verts.slice(minIdx).concat(verts.slice(0, minIdx));
    return rotated.join("\u2192");
  }
  function resolveAliases(col, allVars, warnings) {
    for (const v of col.variables) {
      for (const val of Object.values(v.valuesByMode)) {
        if (val.kind !== "alias")
          continue;
        if (!allVars.has(val.targetVariableId)) {
          warnings.push({
            type: "UNRESOLVED_ALIAS",
            variableId: v.id,
            targetId: val.targetVariableId
          });
          v.emitToPublic = false;
        }
      }
    }
  }
  function fixKeywords(col, warnings) {
    for (const v of col.variables) {
      if (v.groupPath.length === 0)
        continue;
      const lastIdx = v.groupPath.length - 1;
      const leaf = v.groupPath[lastIdx];
      if (DART_KEYWORDS.has(leaf.toLowerCase())) {
        const fixed = leaf + "_";
        warnings.push({
          type: "KEYWORD_CONFLICT",
          variableId: v.id,
          original: leaf,
          fixed
        });
        v.groupPath[lastIdx] = fixed;
      }
    }
  }
  function fixDuplicates(col, warnings) {
    var _a;
    const seen = /* @__PURE__ */ new Map();
    for (const v of col.variables) {
      if (v.groupPath.length === 0)
        continue;
      const key = v.groupPath.join("/");
      const count = (_a = seen.get(key)) != null ? _a : 0;
      if (count > 0) {
        const lastIdx = v.groupPath.length - 1;
        const leaf = v.groupPath[lastIdx];
        const fixed = `${leaf}_${count + 1}`;
        warnings.push({
          type: "DUPLICATE_DART_NAME",
          variableId: v.id,
          original: leaf,
          fixed
        });
        v.groupPath[lastIdx] = fixed;
      }
      seen.set(key, count + 1);
    }
  }
  function roundFloats(col) {
    for (const v of col.variables) {
      if (v.type !== "FLOAT")
        continue;
      for (const [modeId, val] of Object.entries(v.valuesByMode)) {
        if (val.kind === "literal" && typeof val.value === "number") {
          v.valuesByMode[modeId] = {
            kind: "literal",
            value: Math.round(val.value * 1e6) / 1e6
          };
        }
      }
    }
  }
  function applyHidden(col) {
    for (const v of col.variables) {
      if (v.hiddenFromPublishing)
        v.emitToPublic = false;
    }
  }

  // src/sanitize.ts
  function newSanitizeContext() {
    return { existingByParent: /* @__PURE__ */ new Map() };
  }
  function sanitize(figmaPath, ctx) {
    const segments = figmaPath.map((s) => s.trim()).filter((s) => s.length > 0).map(processSegment);
    if (segments.length === 0) {
      segments.push("unnamed");
    }
    const groupPath = segments.slice(0, -1).map(toPascalCase);
    const rawLeaf = segments[segments.length - 1];
    let leafName = toCamelCase(rawLeaf);
    if (DART_KEYWORDS.has(leafName))
      leafName = leafName + "_";
    const parentKey = groupPath.join("/");
    let used = ctx.existingByParent.get(parentKey);
    if (!used) {
      used = /* @__PURE__ */ new Set();
      ctx.existingByParent.set(parentKey, used);
    }
    if (used.has(leafName)) {
      let i = 2;
      while (used.has(`${leafName}_${i}`))
        i++;
      leafName = `${leafName}_${i}`;
    }
    used.add(leafName);
    return { groupPath, leafName };
  }
  function processSegment(seg) {
    let out = transliterate(seg);
    out = out.replace(/[\s\-_.]+/g, " ");
    out = out.replace(/[^a-zA-Z0-9 ]/g, "");
    out = out.trim();
    if (out.length === 0)
      return "unnamed";
    const words = out.split(/\s+/);
    if (words.length > 1) {
      while (words.length > 1 && /^\d+$/.test(words[0]))
        words.shift();
      out = words.join(" ");
    }
    if (/^\d/.test(out))
      out = "n" + out;
    return out;
  }
  function sanitizeIdentifier(raw, style = "pascal") {
    const processed = processSegment(raw);
    let id = style === "pascal" ? toPascalCase(processed) : toCamelCase(processed);
    if (style === "camel" && DART_KEYWORDS.has(id))
      id = id + "_";
    return id;
  }
  function toPascalCase(s) {
    return splitWords(s).map(capitalize).join("");
  }
  function toCamelCase(s) {
    const words = splitWords(s);
    if (words.length === 0)
      return "unnamed";
    return words[0].toLowerCase() + words.slice(1).map(capitalize).join("");
  }
  function splitWords(s) {
    const out = [];
    for (const chunk of s.split(/\s+/).filter(Boolean)) {
      const expanded = chunk.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Za-z])([0-9])/g, "$1 $2").replace(/([0-9])([A-Za-z])/g, "$1 $2");
      out.push(...expanded.split(/\s+/).filter(Boolean));
    }
    return out;
  }
  function capitalize(w) {
    if (!w)
      return "";
    return w[0].toUpperCase() + w.slice(1).toLowerCase();
  }
  var VIET_MAP = {
    \u00E0: "a",
    \u00E1: "a",
    \u00E2: "a",
    \u00E3: "a",
    \u00E4: "a",
    \u00E5: "a",
    \u00E8: "e",
    \u00E9: "e",
    \u00EA: "e",
    \u00EB: "e",
    \u00EC: "i",
    \u00ED: "i",
    \u00EE: "i",
    \u00EF: "i",
    \u00F2: "o",
    \u00F3: "o",
    \u00F4: "o",
    \u00F5: "o",
    \u00F6: "o",
    \u00F9: "u",
    \u00FA: "u",
    \u00FB: "u",
    \u00FC: "u",
    \u00FD: "y",
    \u00FF: "y",
    \u0103: "a",
    \u1EAF: "a",
    \u1EB7: "a",
    \u1EB3: "a",
    \u1EB5: "a",
    \u1EB1: "a",
    \u1EA5: "a",
    \u1EAD: "a",
    \u1EA9: "a",
    \u1EAB: "a",
    \u1EA7: "a",
    \u1EA1: "a",
    \u1EA3: "a",
    \u0111: "d",
    \u1EBF: "e",
    \u1EC7: "e",
    \u1EC3: "e",
    \u1EC5: "e",
    \u1EC1: "e",
    \u1EB9: "e",
    \u1EBB: "e",
    \u1EBD: "e",
    \u1ED1: "o",
    \u1ED9: "o",
    \u1ED5: "o",
    \u1ED7: "o",
    \u1ED3: "o",
    \u1ECD: "o",
    \u1ECF: "o",
    \u01A1: "o",
    \u1EDB: "o",
    \u1EE3: "o",
    \u1EDF: "o",
    \u1EE1: "o",
    \u1EDD: "o",
    \u01B0: "u",
    \u1EE9: "u",
    \u1EF1: "u",
    \u1EED: "u",
    \u1EEF: "u",
    \u1EEB: "u",
    \u1EE5: "u",
    \u1EE7: "u",
    \u0169: "u",
    \u1EF3: "y",
    \u1EF5: "y",
    \u1EF7: "y",
    \u1EF9: "y",
    \u00F1: "n",
    \u00E7: "c",
    \u00DF: "ss"
  };
  function transliterate(s) {
    let out = "";
    for (const ch of s) {
      const lower = ch.toLowerCase();
      const replacement = VIET_MAP[lower];
      if (replacement !== void 0) {
        out += ch === lower ? replacement : replacement.toUpperCase();
      } else {
        out += ch;
      }
    }
    return out.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  // src/generator/prepare.ts
  function prepareIR(ir) {
    const collections = ir.collections.map(prepareCollection);
    const varIndex = /* @__PURE__ */ new Map();
    for (const col of collections) {
      for (const v of col.variables) {
        varIndex.set(v.id, {
          collectionAccessor: col.accessor,
          groupPath: v.groupPath,
          leafName: v.leafName,
          dartType: v.dartType
        });
      }
    }
    return {
      collections,
      paintStyles: ir.composites.paintStyles.map((s) => preparePaint(s)),
      effectStyles: ir.composites.effectStyles.map((s) => prepareEffect(s)),
      textStyles: ir.composites.textStyles.map((s) => prepareText(s)),
      varIndex
    };
  }
  function prepareCollection(col) {
    const className = sanitizeIdentifier(col.name, "pascal");
    const accessor = lowerFirst(className);
    const modes = col.modes.map((m) => ({
      id: m.id,
      pascal: sanitizeIdentifier(m.name, "pascal"),
      camel: sanitizeIdentifier(m.name, "camel")
    }));
    const ctx = newSanitizeContext();
    const variables = [];
    for (const v of col.variables) {
      if (!v.emitToPublic)
        continue;
      const { groupPath, leafName } = sanitize(v.groupPath, ctx);
      variables.push({
        id: v.id,
        figmaName: v.figmaName,
        groupPath,
        leafName,
        dartType: dartTypeOf(v.type),
        valuesByMode: v.valuesByMode,
        emitToPublic: v.emitToPublic
      });
    }
    return {
      id: col.id,
      className,
      accessor,
      defaultModeIndex: 0,
      modes,
      variables,
      fileBaseName: pascalToSnake(className)
    };
  }
  function preparePaint(s) {
    const { groupName, getterName } = splitFigmaNameForComposite(
      paintBucket(s.type),
      s.figmaName
    );
    return { id: s.id, type: s.type, groupName, getterName, raw: s };
  }
  function prepareEffect(s) {
    const { groupName, getterName } = splitFigmaNameForComposite(
      effectBucket(s.type),
      s.figmaName
    );
    return { id: s.id, type: s.type, groupName, getterName, raw: s };
  }
  function prepareText(s) {
    const segments = s.figmaName.split("/").map((x) => x.trim()).filter(Boolean);
    let groupName;
    let getterParts;
    if (segments.length >= 2) {
      groupName = sanitizeIdentifier(segments[0], "pascal");
      getterParts = segments.slice(1);
    } else {
      groupName = "Main";
      getterParts = segments;
    }
    const getterName = sanitizeIdentifier(getterParts.join(" "), "camel");
    return { id: s.id, groupName, getterName, raw: s };
  }
  function paintBucket(t) {
    switch (t) {
      case "SOLID":
        return "Solid";
      case "GRADIENT_LINEAR":
        return "Linear";
      case "GRADIENT_RADIAL":
        return "Radial";
      case "GRADIENT_ANGULAR":
        return "Angular";
      case "GRADIENT_DIAMOND":
        return "Diamond";
      case "IMAGE":
        return "Image";
    }
  }
  function effectBucket(t) {
    switch (t) {
      case "DROP_SHADOW":
        return "Drop";
      case "INNER_SHADOW":
        return "Inner";
      case "LAYER_BLUR":
        return "LayerBlur";
      case "BACKGROUND_BLUR":
        return "BackgroundBlur";
    }
  }
  function splitFigmaNameForComposite(groupName, figmaName) {
    const segments = figmaName.split("/").map((s) => s.trim()).filter(Boolean);
    const getter = segments.length === 0 ? "unnamed" : segments.join(" ");
    return { groupName, getterName: sanitizeIdentifier(getter, "camel") };
  }
  function dartTypeOf(t) {
    switch (t) {
      case "COLOR":
        return "Color";
      case "FLOAT":
        return "double";
      case "STRING":
        return "String";
      case "BOOLEAN":
        return "bool";
    }
  }
  function lowerFirst(s) {
    if (!s)
      return s;
    return s[0].toLowerCase() + s.slice(1);
  }
  function pascalToSnake(s) {
    return s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();
  }

  // src/generator/emit_helpers.ts
  var FILE_HEADER = `// GENERATED FILE \u2014 do not edit by hand.
// Generated by Figma \u2192 Flutter Design System Plugin.

`;
  function rgbaToHex(rgba) {
    const hex = (v) => Math.round(clamp01(v) * 255).toString(16).padStart(2, "0").toUpperCase();
    return `0x${hex(rgba.a)}${hex(rgba.r)}${hex(rgba.g)}${hex(rgba.b)}`;
  }
  function colorLiteral(rgba) {
    return `const Color(${rgbaToHex(rgba)})`;
  }
  function doubleLiteral(n) {
    if (!Number.isFinite(n))
      return "0.0";
    if (Number.isInteger(n))
      return `${n}.0`;
    const fixed = (Math.round(n * 1e6) / 1e6).toFixed(6);
    return fixed.replace(/0+$/, "").replace(/\.$/, ".0");
  }
  function stringLiteral(s) {
    return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  function boolLiteral(b) {
    return b ? "true" : "false";
  }
  function clamp01(n) {
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }
  function angleToAlignmentDart(radians) {
    const round = (v) => {
      const r = Math.round(v * 1e6) / 1e6;
      return r === 0 ? 0 : r;
    };
    const sin = round(Math.sin(radians));
    const cos = round(Math.cos(radians));
    return {
      begin: `Alignment(${doubleLiteral(-sin)}, ${doubleLiteral(-cos)})`,
      end: `Alignment(${doubleLiteral(sin)}, ${doubleLiteral(cos)})`
    };
  }

  // src/generator/collection.ts
  function emitCollection(col, varIndex) {
    const root = buildTree(col.variables);
    const usesColor = collectionUsesColor(col);
    const usesAlias = collectionUsesAlias(col);
    const cn = col.className;
    const groupClass = (path) => cn + path.join("");
    const constMap = computeConstMap(root, usesAlias);
    let out = FILE_HEADER;
    if (usesColor) {
      out += `import 'package:flutter/painting.dart';
`;
    }
    out += `import '../_internal/lerp.dart';
`;
    if (usesAlias) {
      out += `import '../theme.dart';
`;
    }
    out += "\n";
    out += `enum ${cn}Mode { ${col.modes.map((m) => m.camel).join(", ")} }

`;
    emitNode(root, true);
    return out;
    function emitNode(node, isRoot) {
      for (const child of node.children.values())
        emitNode(child, false);
      if (isRoot) {
        emitRootClasses(node);
      } else {
        emitGroupClasses(node);
      }
    }
    function emitGroupClasses(node) {
      const className = groupClass(node.path);
      const childGroupEntries = [...node.children.entries()];
      const fieldName = (childPath) => camelOfPascal(childPath[childPath.length - 1]);
      out += `abstract class ${className} {
`;
      out += `  const ${className}();
`;
      for (const [, child] of childGroupEntries) {
        const childCls = groupClass(child.path);
        out += `  ${childCls} get ${fieldName(child.path)};
`;
      }
      for (const leaf of node.leaves) {
        out += `  ${leaf.dartType} get ${leaf.leafName};
`;
      }
      out += `
  static ${className} lerp(${className} a, ${className} b, double t) =>
`;
      out += `      _Lerped${className}(
`;
      for (const [, child] of childGroupEntries) {
        const childCls = groupClass(child.path);
        const fn = fieldName(child.path);
        out += `        ${fn}: ${childCls}.lerp(a.${fn}, b.${fn}, t),
`;
      }
      for (const leaf of node.leaves) {
        out += `        ${leaf.leafName}: a.${leaf.leafName}.lerpTo(b.${leaf.leafName}, t),
`;
      }
      out += `      );
`;
      out += `}

`;
      for (const mode of col.modes) {
        const concreteName = `${className}${mode.pascal}`;
        const isConst = constMap.get(node) === true;
        const ctorPrefix = isConst && childGroupEntries.length === 0 ? "const " : "";
        out += `class ${concreteName} extends ${className} {
`;
        if (childGroupEntries.length > 0) {
          out += `  ${ctorPrefix}${concreteName}()
      : `;
          const inits = childGroupEntries.map(([, child]) => {
            const childCls = groupClass(child.path);
            const childConst = constMap.get(child) === true ? "const " : "";
            return `${fieldName(child.path)} = ${childConst}${childCls}${mode.pascal}()`;
          });
          out += inits.join(",\n        ") + ";\n";
        } else {
          out += `  ${ctorPrefix}${concreteName}();
`;
        }
        for (const [, child] of childGroupEntries) {
          const childCls = groupClass(child.path);
          out += `  @override final ${childCls} ${fieldName(child.path)};
`;
        }
        for (const leaf of node.leaves) {
          const expr = emitValueExpr(leaf, mode.id);
          out += `  @override ${leaf.dartType} get ${leaf.leafName} => ${expr};
`;
        }
        out += `}

`;
      }
      const lerpedName = `_Lerped${className}`;
      const childFields = childGroupEntries.map(([, child]) => ({
        type: groupClass(child.path),
        name: fieldName(child.path)
      }));
      const leafFields = node.leaves.map((l) => ({
        type: l.dartType,
        name: l.leafName
      }));
      const allFields = [...childFields, ...leafFields];
      out += `class ${lerpedName} extends ${className} {
`;
      if (allFields.length > 0) {
        out += `  const ${lerpedName}({
`;
        for (const f of allFields)
          out += `    required this.${f.name},
`;
        out += `  });
`;
        for (const f of allFields) {
          out += `  @override final ${f.type} ${f.name};
`;
        }
      } else {
        out += `  const ${lerpedName}();
`;
      }
      out += `}

`;
    }
    function emitRootClasses(node) {
      const className = cn;
      const childGroupEntries = [...node.children.entries()];
      const fieldName = (childPath) => camelOfPascal(childPath[childPath.length - 1]);
      const ctor = childGroupEntries.length > 0 ? "" : "const ";
      out += `abstract class ${className} {
`;
      out += `  ${ctor}${className}();
`;
      for (const [, child] of childGroupEntries) {
        const childCls = groupClass(child.path);
        out += `  ${childCls} get ${fieldName(child.path)};
`;
      }
      for (const leaf of node.leaves) {
        out += `  ${leaf.dartType} get ${leaf.leafName};
`;
      }
      out += `
  static ${className} lerp(${className} a, ${className} b, double t) =>
`;
      out += `      _Lerped${className}(
`;
      for (const [, child] of childGroupEntries) {
        const childCls = groupClass(child.path);
        const fn = fieldName(child.path);
        out += `        ${fn}: ${childCls}.lerp(a.${fn}, b.${fn}, t),
`;
      }
      for (const leaf of node.leaves) {
        out += `        ${leaf.leafName}: a.${leaf.leafName}.lerpTo(b.${leaf.leafName}, t),
`;
      }
      out += `      );
}

`;
      for (const mode of col.modes) {
        const concreteName = `${className}${mode.pascal}`;
        out += `class ${concreteName} extends ${className} {
`;
        if (childGroupEntries.length > 0) {
          out += `  ${concreteName}()
      : `;
          const inits = childGroupEntries.map(([, child]) => {
            const childCls = groupClass(child.path);
            const childConst = constMap.get(child) === true ? "const " : "";
            return `${fieldName(child.path)} = ${childConst}${childCls}${mode.pascal}()`;
          });
          out += inits.join(",\n        ") + ";\n";
        } else {
          out += `  const ${concreteName}();
`;
        }
        for (const [, child] of childGroupEntries) {
          const childCls = groupClass(child.path);
          out += `  @override final ${childCls} ${fieldName(child.path)};
`;
        }
        for (const leaf of node.leaves) {
          const expr = emitValueExpr(leaf, mode.id);
          out += `  @override ${leaf.dartType} get ${leaf.leafName} => ${expr};
`;
        }
        out += `}

`;
      }
      const lerpedName = `_Lerped${className}`;
      const childFields = childGroupEntries.map(([, child]) => ({
        type: groupClass(child.path),
        name: fieldName(child.path)
      }));
      const leafFields = node.leaves.map((l) => ({
        type: l.dartType,
        name: l.leafName
      }));
      const allFields = [...childFields, ...leafFields];
      out += `class ${lerpedName} extends ${className} {
`;
      if (allFields.length > 0) {
        out += `  ${lerpedName}({
`;
        for (const f of allFields)
          out += `    required this.${f.name},
`;
        out += `  });
`;
        for (const f of allFields) {
          out += `  @override final ${f.type} ${f.name};
`;
        }
      } else {
        out += `  ${lerpedName}();
`;
      }
      out += `}
`;
    }
    function emitValueExpr(v, modeId) {
      const val = v.valuesByMode[modeId];
      if (!val) {
        return defaultExprFor(v.dartType);
      }
      if (val.kind === "alias") {
        const ref = varIndex.get(val.targetVariableId);
        if (!ref)
          return defaultExprFor(v.dartType);
        const path = [
          `AppTheme`,
          ref.collectionAccessor,
          ...ref.groupPath.map(camelOfPascal),
          ref.leafName
        ];
        return path.join(".");
      }
      return literalFor(v.dartType, val);
    }
  }
  function buildTree(variables) {
    const root = {
      path: [],
      children: /* @__PURE__ */ new Map(),
      leaves: []
    };
    for (const v of variables) {
      let node = root;
      if (v.groupPath.length === 0) {
        node = ensureChild(root, "Main");
      } else {
        for (const seg of v.groupPath) {
          node = ensureChild(node, seg);
        }
      }
      node.leaves.push(v);
    }
    return root;
  }
  function ensureChild(parent, name) {
    const existing = parent.children.get(name);
    if (existing)
      return existing;
    const child = {
      path: [...parent.path, name],
      children: /* @__PURE__ */ new Map(),
      leaves: []
    };
    parent.children.set(name, child);
    return child;
  }
  function computeConstMap(root, usesAlias) {
    const map = /* @__PURE__ */ new Map();
    function walk(node) {
      const isConst = !usesAlias && node.children.size === 0;
      map.set(node, isConst);
      for (const child of node.children.values())
        walk(child);
    }
    walk(root);
    if (root.children.size > 0)
      map.set(root, false);
    return map;
  }
  function camelOfPascal(s) {
    if (!s)
      return s;
    return s[0].toLowerCase() + s.slice(1);
  }
  function literalFor(t, v) {
    if (v.kind !== "literal")
      return defaultExprFor(t);
    switch (t) {
      case "Color":
        return colorLiteral(v.value);
      case "double":
        return doubleLiteral(v.value);
      case "String":
        return stringLiteral(v.value);
      case "bool":
        return boolLiteral(v.value);
    }
  }
  function defaultExprFor(t) {
    switch (t) {
      case "Color":
        return "const Color(0x00000000)";
      case "double":
        return "0.0";
      case "String":
        return "''";
      case "bool":
        return "false";
    }
  }
  function collectionUsesColor(col) {
    return col.variables.some((v) => v.dartType === "Color");
  }
  function collectionUsesAlias(col) {
    return col.variables.some(
      (v) => Object.values(v.valuesByMode).some((val) => val.kind === "alias")
    );
  }

  // src/generator/composites.ts
  function emitColorStyles(styles, varIndex) {
    const buckets = /* @__PURE__ */ new Map();
    for (const s of styles) {
      if (!buckets.has(s.groupName))
        buckets.set(s.groupName, []);
      buckets.get(s.groupName).push(s);
    }
    const ordered = [
      "Solid",
      "Linear",
      "Radial",
      "Angular",
      "Diamond",
      "Image"
    ].filter((b) => buckets.has(b)).map((b) => [b, buckets.get(b)]);
    let out = FILE_HEADER;
    out += `import 'dart:math' show pi;
`;
    out += `import 'package:flutter/painting.dart';
`;
    out += `import '../theme.dart';

`;
    out += `// ignore_for_file: unused_import

`;
    for (const [bucket, items] of ordered) {
      const cls = `DSColorStyles${bucket}`;
      out += `class ${cls} {
`;
      out += `  const ${cls}();

`;
      for (const s of items) {
        out += emitPaintGetter(s, varIndex);
      }
      out += `}

`;
    }
    if (buckets.has("Diamond")) {
      out += `class _DiamondTransform extends GradientTransform {
`;
      out += `  const _DiamondTransform();
`;
      out += `  @override
`;
      out += `  Matrix4? transform(Rect bounds, {TextDirection? textDirection}) {
`;
      out += `    return Matrix4.identity()..scale(1.0, 0.5, 1.0);
`;
      out += `  }
`;
      out += `}

`;
    }
    out += `class DSColorStyles {
`;
    out += `  const DSColorStyles();
`;
    for (const [bucket] of ordered) {
      const field = bucket[0].toLowerCase() + bucket.slice(1);
      out += `  final DSColorStyles${bucket} ${field} = const DSColorStyles${bucket}();
`;
    }
    out += `}
`;
    return out;
  }
  function emitPaintGetter(s, varIndex) {
    const r = s.raw;
    switch (r.type) {
      case "SOLID":
        return `  Color get ${s.getterName} => ${colorRef(r.color, varIndex)};

`;
      case "GRADIENT_LINEAR": {
        const { begin, end } = angleToAlignmentDart(r.angleRadians);
        return `  LinearGradient get ${s.getterName} => LinearGradient(
    begin: ${begin},
    end: ${end},
    stops: ${stopsLiteral(r.stops)},
    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(", ")}],
  );

`;
      }
      case "GRADIENT_RADIAL":
        return `  RadialGradient get ${s.getterName} => RadialGradient(
    center: Alignment(${doubleLiteral((r.center.x - 0.5) * 2)}, ${doubleLiteral((r.center.y - 0.5) * 2)}),
    radius: ${doubleLiteral(r.radius * 2)},
    stops: ${stopsLiteral(r.stops)},
    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(", ")}],
  );

`;
      case "GRADIENT_ANGULAR":
        return `  SweepGradient get ${s.getterName} => SweepGradient(
    center: Alignment.center,
    startAngle: ${doubleLiteral(r.startAngle)},
    endAngle: ${doubleLiteral(r.endAngle)},
    stops: ${stopsLiteral(r.stops)},
    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(", ")}],
  );

`;
      case "GRADIENT_DIAMOND":
        return `  // Approximated from Figma GRADIENT_DIAMOND.
  RadialGradient get ${s.getterName} => RadialGradient(
    center: Alignment.center,
    radius: 1.0,
    transform: const _DiamondTransform(),
    stops: ${stopsLiteral(r.stops)},
    colors: [${r.stops.map((st) => colorRef(st.color, varIndex)).join(", ")}],
  );

`;
      case "IMAGE":
        return `  String get ${s.getterName} => ${stringLiteral(`packages/design_system/assets/${r.assetName}`)};

`;
    }
  }
  function colorRef(c, varIndex) {
    if (c.kind === "alias") {
      const ref = varIndex.get(c.targetVariableId);
      if (!ref)
        return "const Color(0x00000000)";
      const segs = [
        "AppTheme",
        ref.collectionAccessor,
        ...ref.groupPath.map(lowerFirst2),
        ref.leafName
      ];
      return segs.join(".");
    }
    return colorLiteral(c.rgba);
  }
  function stopsLiteral(stops) {
    return `const [${stops.map((s) => doubleLiteral(s.position)).join(", ")}]`;
  }
  function emitShadows(styles, varIndex) {
    const drops = styles.filter((s) => s.type === "DROP_SHADOW");
    const inners = styles.filter((s) => s.type === "INNER_SHADOW");
    const blurs = styles.filter(
      (s) => s.type === "LAYER_BLUR" || s.type === "BACKGROUND_BLUR"
    );
    let out = FILE_HEADER;
    out += `import 'dart:ui' show ImageFilter;
`;
    out += `import 'package:flutter/painting.dart';
`;
    out += `import '../theme.dart';

`;
    out += `// ignore_for_file: unused_import

`;
    out += `class DSShadow extends BoxShadow {
`;
    out += `  const DSShadow({
`;
    out += `    super.color,
`;
    out += `    super.offset,
`;
    out += `    super.blurRadius,
`;
    out += `    super.spreadRadius,
`;
    out += `    super.blurStyle,
`;
    out += `  });
`;
    out += `}

`;
    if (drops.length > 0) {
      out += `class DSDropShadows {
  const DSDropShadows();

`;
      for (const s of drops)
        out += emitShadowGetter(s, varIndex, "normal");
      out += `}

`;
    }
    if (inners.length > 0) {
      out += `class DSInnerShadows {
  const DSInnerShadows();

`;
      for (const s of inners)
        out += emitShadowGetter(s, varIndex, "inner");
      out += `}

`;
    }
    if (blurs.length > 0) {
      out += `class DSBlurs {
  const DSBlurs();

`;
      for (const s of blurs) {
        const r = s.raw;
        out += `  ImageFilter get ${s.getterName} => ImageFilter.blur(sigmaX: ${doubleLiteral(r.sigmaX)}, sigmaY: ${doubleLiteral(r.sigmaY)});

`;
      }
      out += `}

`;
    }
    out += `class DSShadows {
  const DSShadows();
`;
    if (drops.length > 0)
      out += `  final DSDropShadows drop = const DSDropShadows();
`;
    if (inners.length > 0)
      out += `  final DSInnerShadows inner = const DSInnerShadows();
`;
    if (blurs.length > 0)
      out += `  final DSBlurs blur = const DSBlurs();
`;
    out += `}
`;
    return out;
  }
  function emitShadowGetter(s, varIndex, blurStyle) {
    const r = s.raw;
    const colorIsLiteral = r.color.kind === "literal";
    const colorExpr = colorRef(r.color, varIndex);
    const constKw = colorIsLiteral ? "const " : "";
    return `  List<DSShadow> get ${s.getterName} => ${constKw}[
    DSShadow(
      color: ${colorExpr},
      offset: ${colorIsLiteral ? "Offset" : "const Offset"}(${doubleLiteral(r.offsetX)}, ${doubleLiteral(r.offsetY)}),
      blurRadius: ${doubleLiteral(r.blurRadius)},
      spreadRadius: ${doubleLiteral(r.spreadRadius)},
      blurStyle: BlurStyle.${blurStyle},
    ),
  ];

`;
  }
  function emitTextStyles(styles, varIndex) {
    const buckets = /* @__PURE__ */ new Map();
    for (const s of styles) {
      if (!buckets.has(s.groupName))
        buckets.set(s.groupName, []);
      buckets.get(s.groupName).push(s);
    }
    const ordered = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
    let out = FILE_HEADER;
    out += `import 'package:flutter/painting.dart';
`;
    out += `import '../theme.dart';

`;
    out += `// ignore_for_file: unused_import

`;
    out += `class DSTextStyle extends TextStyle {
`;
    out += `  const DSTextStyle._({
`;
    out += `    super.color,
`;
    out += `    super.fontFamily,
`;
    out += `    super.fontSize,
`;
    out += `    super.fontWeight,
`;
    out += `    super.height,
`;
    out += `    super.letterSpacing,
`;
    out += `    super.decoration,
`;
    out += `  });

`;
    out += `  DSTextStyle tint(Color? c) => _from(copyWith(color: c));

`;
    out += `  DSTextStyle styled({
`;
    out += `    Color? color,
`;
    out += `    double? fontSize,
`;
    out += `    FontWeight? fontWeight,
`;
    out += `    double? height,
`;
    out += `    double? letterSpacing,
`;
    out += `    TextDecoration? decoration,
`;
    out += `  }) => _from(copyWith(
`;
    out += `    color: color, fontSize: fontSize, fontWeight: fontWeight,
`;
    out += `    height: height, letterSpacing: letterSpacing, decoration: decoration,
`;
    out += `  ));

`;
    out += `  static DSTextStyle _from(TextStyle s) => DSTextStyle._(
`;
    out += `    color: s.color, fontFamily: s.fontFamily, fontSize: s.fontSize,
`;
    out += `    fontWeight: s.fontWeight, height: s.height,
`;
    out += `    letterSpacing: s.letterSpacing, decoration: s.decoration,
`;
    out += `  );

`;
    out += `  static FontWeight _bucket(double v) => switch (v) {
`;
    out += `    <= 100 => FontWeight.w100, <= 200 => FontWeight.w200,
`;
    out += `    <= 300 => FontWeight.w300, <= 400 => FontWeight.w400,
`;
    out += `    <= 500 => FontWeight.w500, <= 600 => FontWeight.w600,
`;
    out += `    <= 700 => FontWeight.w700, <= 800 => FontWeight.w800,
`;
    out += `    _      => FontWeight.w900,
`;
    out += `  };
`;
    out += `}

`;
    for (const [bucket, items] of ordered) {
      const cls = `DSStyles${bucket}`;
      out += `class ${cls} {
`;
      out += `  const ${cls}();

`;
      for (const s of items)
        out += emitTextGetter(s, varIndex);
      out += `}

`;
    }
    out += `class DSStyles {
`;
    out += `  const DSStyles();
`;
    for (const [bucket] of ordered) {
      const field = bucket[0].toLowerCase() + bucket.slice(1);
      out += `  final DSStyles${bucket} ${field} = const DSStyles${bucket}();
`;
    }
    out += `}
`;
    return out;
  }
  function emitTextGetter(s, varIndex) {
    const r = s.raw;
    const fontSize = textValue(r.fontSize, varIndex, "double");
    const fontFamily = textValue(r.fontFamily, varIndex, "String");
    const fontWeight = textValue(r.fontWeight, varIndex, "double");
    const lh = lineHeightExpr(r.lineHeight, fontSize, varIndex);
    const ls = letterSpacingExpr(r.letterSpacing, fontSize, varIndex);
    return `  DSTextStyle get ${s.getterName} {
    final fs = ${fontSize};
    return DSTextStyle._(
      fontFamily: ${fontFamily},
      fontSize: fs,
      fontWeight: DSTextStyle._bucket(${fontWeight}),
      height: ${lh},
      letterSpacing: ${ls},
    );
  }

`;
  }
  function textValue(v, varIndex, type) {
    if (v.kind === "alias")
      return aliasExpr(v.targetVariableId, varIndex, type);
    if (type === "String")
      return stringLiteral(v.value);
    return doubleLiteral(v.value);
  }
  function lineHeightExpr(v, fontSizeExpr, varIndex) {
    if (v.kind === "alias")
      return `(${aliasExpr(v.targetVariableId, varIndex, "double")} / fs)`;
    if (v.unit === "AUTO")
      return "null";
    if (v.unit === "PIXELS")
      return `(${doubleLiteral(v.value)} / fs)`;
    return `${doubleLiteral(v.value / 100)}`;
  }
  function letterSpacingExpr(v, fontSizeExpr, varIndex) {
    if (v.kind === "alias")
      return aliasExpr(v.targetVariableId, varIndex, "double");
    if (v.unit === "PIXELS")
      return doubleLiteral(v.value);
    return `(${doubleLiteral(v.value / 100)} * fs)`;
  }
  function aliasExpr(id, varIndex, type) {
    const ref = varIndex.get(id);
    if (!ref)
      return type === "String" ? "''" : "0.0";
    return [
      "AppTheme",
      ref.collectionAccessor,
      ...ref.groupPath.map((s) => s[0].toLowerCase() + s.slice(1)),
      ref.leafName
    ].join(".");
  }
  function lowerFirst2(s) {
    return s ? s[0].toLowerCase() + s.slice(1) : s;
  }

  // src/generator/controller.ts
  function emitController(collections) {
    let out = FILE_HEADER;
    out += `import 'package:flutter/animation.dart';
`;
    out += `import 'package:flutter/foundation.dart';

`;
    for (const col of collections) {
      out += `import '../${collectionDir(col)}/${col.fileBaseName}.dart';
`;
    }
    out += `
`;
    out += `class DesignSystemController extends ChangeNotifier {
`;
    out += `  DesignSystemController._();
`;
    out += `  static final DesignSystemController instance = DesignSystemController._();

`;
    for (const col of collections) {
      out += controllerBlock(col);
    }
    out += `  Duration _animDuration = const Duration(milliseconds: 300);
`;
    out += `  Duration get animDuration => _animDuration;

`;
    out += `  void setAnimationDuration(Duration d) {
`;
    out += `    _animDuration = d;
`;
    out += `    for (final c in _allAnims) c.duration = d;
`;
    out += `  }

`;
    out += `  List<AnimationController> get _allAnims => [
`;
    for (const col of collections) {
      out += `    if (_${col.accessor}Anim != null) _${col.accessor}Anim!,
`;
    }
    out += `  ];

`;
    out += `  bool _vsyncAttached = false;

`;
    out += `  void attachVsync(TickerProvider vsync) {
`;
    out += `    if (_vsyncAttached) _detachControllers();
`;
    out += `    _vsyncAttached = true;
`;
    out += `    AnimationController make() => AnimationController(vsync: vsync, duration: _animDuration)
`;
    out += `      ..addListener(notifyListeners);
`;
    for (const col of collections) {
      out += `    _${col.accessor}Anim = make();
`;
    }
    out += `  }

`;
    out += `  void detachVsync() {
`;
    out += `    _detachControllers();
`;
    out += `    _vsyncAttached = false;
`;
    out += `  }

`;
    out += `  void _detachControllers() {
`;
    for (const col of collections) {
      out += `    _${col.accessor}Anim?.dispose(); _${col.accessor}Anim = null;
`;
    }
    out += `  }

`;
    out += `  void _trigger(AnimationController? anim) {
`;
    out += `    if (anim == null || _animDuration == Duration.zero) {
`;
    out += `      notifyListeners();
`;
    out += `      return;
`;
    out += `    }
`;
    out += `    anim.forward(from: 0);
`;
    out += `    notifyListeners();
`;
    out += `  }

`;
    out += `  @visibleForTesting
`;
    out += `  void resetForTest() {
`;
    out += `    _detachControllers();
`;
    out += `    _vsyncAttached = false;
`;
    for (const col of collections) {
      const def = defaultConcrete(col);
      out += `    _${col.accessor} = ${def}();
`;
      out += `    _${col.accessor}Prev = ${def}();
`;
      out += `    current${col.className}Mode = ${col.className}Mode.${col.modes[col.defaultModeIndex].camel};
`;
    }
    out += `  }
`;
    out += `}
`;
    return out;
  }
  function controllerBlock(col) {
    const accessor = col.accessor;
    const cls = col.className;
    const def = defaultConcrete(col);
    const modes = col.modes;
    const defaultMode = modes[col.defaultModeIndex];
    let out = "";
    out += `  // ${cls}
`;
    out += `  ${cls} _${accessor} = ${def}();
`;
    out += `  ${cls} _${accessor}Prev = ${def}();
`;
    out += `  AnimationController? _${accessor}Anim;
`;
    out += `  ${cls}Mode current${cls}Mode = ${cls}Mode.${defaultMode.camel};

`;
    out += `  ${cls} get ${accessor} {
`;
    out += `    final a = _${accessor}Anim;
`;
    out += `    if (a != null && a.isAnimating) return ${cls}.lerp(_${accessor}Prev, _${accessor}, a.value);
`;
    out += `    return _${accessor};
`;
    out += `  }

`;
    out += `  void set${cls}Mode(${cls}Mode mode) {
`;
    out += `    if (mode == current${cls}Mode) return;
`;
    out += `    current${cls}Mode = mode;
`;
    out += `    _${accessor}Prev = ${accessor};
`;
    out += `    _${accessor} = switch (mode) {
`;
    for (const m of modes) {
      out += `      ${cls}Mode.${m.camel} => ${cls}${m.pascal}(),
`;
    }
    out += `    };
`;
    out += `    _trigger(_${accessor}Anim);
`;
    out += `  }

`;
    return out;
  }
  function defaultConcrete(col) {
    return `${col.className}${col.modes[col.defaultModeIndex].pascal}`;
  }
  function collectionDir(col) {
    for (const v of col.variables) {
      for (const val of Object.values(v.valuesByMode)) {
        if (val.kind === "alias")
          return "tokens";
      }
    }
    return "primitives";
  }

  // src/generator/theme.ts
  function emitTheme(collections, hasComposites) {
    let out = FILE_HEADER;
    out += `import '_internal/controller.dart';
`;
    if (hasComposites.paintStyles)
      out += `import 'composites/color_styles.dart';
`;
    if (hasComposites.effectStyles)
      out += `import 'composites/shadows.dart';
`;
    if (hasComposites.textStyles)
      out += `import 'composites/text_styles.dart';
`;
    for (const col of collections) {
      out += `import '${collectionDir(col)}/${col.fileBaseName}.dart';
`;
    }
    out += `
`;
    out += `class AppTheme {
`;
    out += `  AppTheme._();

`;
    for (const col of collections) {
      out += `  static ${col.className} get ${col.accessor} =>
`;
      out += `      DesignSystemController.instance.${col.accessor};

`;
    }
    if (hasComposites.textStyles)
      out += `  static const DSStyles textStyles = DSStyles();
`;
    if (hasComposites.effectStyles)
      out += `  static const DSShadows shadows = DSShadows();
`;
    if (hasComposites.paintStyles)
      out += `  static const DSColorStyles colorStyle = DSColorStyles();
`;
    out += `
`;
    for (const col of collections) {
      out += `  static void set${col.className}Mode(${col.className}Mode m) =>
`;
      out += `      DesignSystemController.instance.set${col.className}Mode(m);

`;
    }
    out += `  static void setAnimationDuration(Duration d) =>
`;
    out += `      DesignSystemController.instance.setAnimationDuration(d);

`;
    for (const col of collections) {
      out += `  static ${col.className}Mode get current${col.className}Mode =>
`;
      out += `      DesignSystemController.instance.current${col.className}Mode;

`;
    }
    out += `}
`;
    return out;
  }

  // src/generator/barrel.ts
  function emitBarrel(collections, hasComposites) {
    let out = `/// Design system package \u2014 generated by the Figma \u2192 Flutter plugin.
`;
    out += `/// Do not edit by hand.
`;
    out += `library design_system;

`;
    out += `${FILE_HEADER}`;
    out += `export 'src/wrapper.dart' show DesignSystemWrapper;
`;
    out += `export 'src/theme.dart' show AppTheme;

`;
    for (const col of collections) {
      const file = `src/${collectionDir(col)}/${col.fileBaseName}.dart`;
      out += `export '${file}' show ${col.className}, ${col.className}Mode;
`;
    }
    out += `
`;
    if (hasComposites.paintStyles)
      out += `export 'src/composites/color_styles.dart' show DSColorStyles;
`;
    if (hasComposites.effectStyles)
      out += `export 'src/composites/shadows.dart' show DSShadow, DSShadows;
`;
    if (hasComposites.textStyles)
      out += `export 'src/composites/text_styles.dart' show DSStyles, DSTextStyle;
`;
    return out;
  }

  // src/generator/static_files.ts
  function lerpDartFile() {
    return FILE_HEADER + `import 'dart:ui' show Color, lerpDouble, ImageFilter;

extension LerpDouble on double {
  double lerpTo(double b, double t) => lerpDouble(this, b, t) ?? this;
}

extension LerpColor on Color {
  Color lerpTo(Color b, double t) => Color.lerp(this, b, t) ?? this;
}

extension LerpString on String {
  String lerpTo(String b, double t) => t < 0.5 ? this : b;
}

extension LerpBool on bool {
  bool lerpTo(bool b, double t) => t < 0.5 ? this : b;
}

extension LerpImageFilter on ImageFilter {
  ImageFilter lerpTo(ImageFilter b, double t) => t < 0.5 ? this : b;
}
`;
  }
  function wrapperDartFile() {
    return FILE_HEADER + `import 'package:flutter/widgets.dart';
import '_internal/controller.dart';

/// Place once near the root of your widget tree, above [MaterialApp].
class DesignSystemWrapper extends StatefulWidget {
  const DesignSystemWrapper({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 300),
  });

  final Widget child;
  final Duration duration;

  @override
  State<DesignSystemWrapper> createState() => _DesignSystemWrapperState();
}

class _DesignSystemWrapperState extends State<DesignSystemWrapper>
    with TickerProviderStateMixin {
  @override
  void initState() {
    super.initState();
    DesignSystemController.instance
      ..setAnimationDuration(widget.duration)
      ..attachVsync(this);
  }

  @override
  void didUpdateWidget(covariant DesignSystemWrapper old) {
    super.didUpdateWidget(old);
    if (old.duration != widget.duration) {
      DesignSystemController.instance.setAnimationDuration(widget.duration);
    }
  }

  @override
  void dispose() {
    DesignSystemController.instance.detachVsync();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: DesignSystemController.instance,
      builder: (_, __) => widget.child,
    );
  }
}
`;
  }
  function pubspecYaml(packageName = "design_system") {
    return `name: ${packageName}
description: >
  Generated Flutter design system package.
  Produced by the Figma \u2192 Flutter plugin. Do not edit by hand.
version: 0.1.0
publish_to: "none"

environment:
  sdk: ">=3.0.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter

dev_dependencies:
  flutter_lints: ^4.0.0
  flutter_test:
    sdk: flutter

flutter:
  uses-material-design: true
`;
  }
  function readmeMd(packageName = "design_system") {
    return `# ${packageName}

Generated Flutter design system. Do not edit by hand.

## Usage

\`\`\`dart
import 'package:${packageName}/${packageName}.dart';

void main() {
  runApp(const DesignSystemWrapper(child: MyApp()));
}

// Read tokens from anywhere \u2014 no BuildContext needed.
final bg = AppTheme.colorToken.background.primary;
final r  = AppTheme.numberBasic.spacing.n16;

// Switch mode at runtime.
AppTheme.setColorTokenMode(ColorTokenMode.lightMode);
\`\`\`
`;
  }

  // src/generator/emit.ts
  function emitPackage(ir, packageName = "design_system") {
    const prepared = prepareIR(ir);
    const collections = prepared.collections.filter(
      (c) => c.variables.length > 0 && c.modes.length > 0
    );
    const files = [];
    for (const col of collections) {
      const dir = collectionDir(col);
      files.push({
        path: `lib/src/${dir}/${col.fileBaseName}.dart`,
        contents: emitCollection(col, prepared.varIndex)
      });
    }
    const hasPaint = prepared.paintStyles.length > 0;
    const hasEffect = prepared.effectStyles.length > 0;
    const hasText = prepared.textStyles.length > 0;
    if (hasPaint) {
      files.push({
        path: "lib/src/composites/color_styles.dart",
        contents: emitColorStyles(prepared.paintStyles, prepared.varIndex)
      });
    }
    if (hasEffect) {
      files.push({
        path: "lib/src/composites/shadows.dart",
        contents: emitShadows(prepared.effectStyles, prepared.varIndex)
      });
    }
    if (hasText) {
      files.push({
        path: "lib/src/composites/text_styles.dart",
        contents: emitTextStyles(prepared.textStyles, prepared.varIndex)
      });
    }
    files.push({ path: "lib/src/_internal/lerp.dart", contents: lerpDartFile() });
    files.push({
      path: "lib/src/_internal/controller.dart",
      contents: emitController(collections)
    });
    files.push({
      path: "lib/src/theme.dart",
      contents: emitTheme(collections, {
        paintStyles: hasPaint,
        effectStyles: hasEffect,
        textStyles: hasText
      })
    });
    files.push({ path: "lib/src/wrapper.dart", contents: wrapperDartFile() });
    files.push({
      path: `lib/${packageName}.dart`,
      contents: emitBarrel(collections, {
        paintStyles: hasPaint,
        effectStyles: hasEffect,
        textStyles: hasText
      })
    });
    files.push({ path: "pubspec.yaml", contents: pubspecYaml(packageName) });
    files.push({ path: "README.md", contents: readmeMd(packageName) });
    return files;
  }

  // src/main.ts
  figma.showUI(__html__, { width: 400, height: 300 });
  figma.ui.onmessage = async (msg) => {
    var _a;
    if (msg.type === "export") {
      try {
        const ir = {
          version: "1.0",
          fileKey: (_a = figma.fileKey) != null ? _a : "unknown",
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          collections: await readVariables(),
          composites: {
            paintStyles: await readPaintStyles(),
            effectStyles: await readEffectStyles(),
            textStyles: await readTextStyles()
          }
        };
        const result = validate(ir);
        console.log("Validation:", {
          errors: result.errors.length,
          warnings: result.warnings.length
        });
        if (result.warnings.length > 0) {
          console.log("Warnings:", result.warnings);
        }
        if (result.errors.length > 0) {
          console.error("Validation errors \u2014 emit blocked:", result.errors);
          figma.ui.postMessage({
            type: "validation-errors",
            errors: result.errors
          });
          return;
        }
        const files = emitPackage(ir, "design_system");
        console.log(
          `Generated ${files.length} files`,
          files.map((f) => f.path)
        );
        figma.ui.postMessage({
          type: "done",
          warnings: result.warnings,
          generated: {
            fileCount: files.length
          }
        });
      } catch (err) {
        console.error("Export failed:", err);
        figma.ui.postMessage({
          type: "error",
          message: err instanceof Error ? err.message : String(err)
        });
      }
    }
  };
})();
