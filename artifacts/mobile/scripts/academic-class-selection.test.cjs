const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const localRequire = createRequire(path.join(__dirname, "../package.json"));
const ts = localRequire("typescript");
const source = fs.readFileSync(path.join(__dirname, "../services/academicClassSelection.ts"), "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(js, { exports: exportsObject });
const { initialAcademicClass, academicClassName, isInstituteStudent } = exportsObject;
const classes = [{ id: 9, name: "Class 9" }, { id: 10, name: "Class 10" }, { id: 11, name: "Class 11" }];

test("board default matches the profile ID, not the first returned grade", () => {
  const selected = initialAcademicClass(classes, { classId: 10 });
  assert.equal(selected.id, 10);
  assert.equal(selected.name, "Class 10");
});
test("numeric API IDs match string profile IDs", () => {
  assert.equal(initialAcademicClass(classes, { classId: "10" }).id, 10);
});
test("board students without an available profile grade stay unselected", () => {
  assert.equal(initialAcademicClass(classes, { classId: 12 }), null);
  assert.equal(initialAcademicClass(classes, { classId: null }), null);
  assert.equal(initialAcademicClass(classes, {}), null);
});
test("empty classes and a not-yet-loaded profile do not default", () => {
  assert.equal(initialAcademicClass([], { classId: 10 }), null);
  assert.equal(initialAcademicClass(classes, undefined), null);
});
test("institute students prefer the assigned class and its organization display name", () => {
  const profile = { classId: "10", className: "Year Ten", orgRole: "student", orgId: 31 };
  assert.equal(initialAcademicClass(classes, profile).id, 10);
  assert.equal(initialAcademicClass(classes, profile).name, "Year Ten");
  assert.equal(academicClassName(classes[1], profile), "Year Ten");
  assert.equal(academicClassName(classes[0], profile), "Class 9");
});
test("institute students fall back only to the first class in their returned list", () => {
  const profile = { classId: 12, className: "Assigned Year", orgRole: "student", orgId: 31 };
  assert.equal(initialAcademicClass(classes, profile).id, 9);
  assert.equal(initialAcademicClass(classes, profile).name, "Class 9");
  assert.equal(initialAcademicClass([], profile), null);
});
test("organization ID alone, or student role alone, does not enable institute fallback", () => {
  for (const profile of [{ classId: 12, orgId: 31 }, { classId: 12, orgRole: "student" }, { classId: 12, orgRole: "teacher", orgId: 31 }]) {
    assert.equal(isInstituteStudent(profile), false);
    assert.equal(initialAcademicClass(classes, profile), null);
  }
});
test("default and display labels neither filter nor mutate the authoritative class list", () => {
  const before = JSON.stringify(classes);
  const profile = { classId: 10, className: "Assigned Year", orgRole: "student", orgId: 31 };
  initialAcademicClass(classes, profile);
  assert.equal(classes.map(item => academicClassName(item, profile)).length, 3);
  assert.equal(JSON.stringify(classes), before);
  assert.equal(academicClassName(classes[1], { classId: 10, className: "Wrong board label" }), "Class 10");
});
