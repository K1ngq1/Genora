import { readFile } from "node:fs/promises";

const [projects, page, packageJson] = await Promise.all([
  readFile("lib/projects.ts", "utf8"),
  readFile("app/workspace/page.tsx", "utf8"),
  readFile("package.json", "utf8"),
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(projects.includes("libraryItems"), "Project canvas data should persist material library items");
assert(page.includes("type MaterialLibraryItem"), "Workspace should define material library item shape");
assert(page.includes("materialLibrary"), "Workspace should keep material library state");
assert(page.includes("material-library-panel"), "Workspace should render a material library panel");
assert(page.includes("addUploadedFileToLibrary"), "Uploaded files should be addable to the material library");
assert(page.includes("saveSelectionToLibrary"), "Selected nodes should be savable to the material library");
assert(page.includes("addLibraryItemToCanvas"), "Library items should be insertable back onto the canvas");
assert(page.includes("activeLibraryFolderId"), "Material library should track the current folder");
assert(page.includes("visibleLibraryItems"), "Material library should show current-folder items without type categories");
assert(page.includes("createLibraryFolder"), "Material library should allow users to create folders");
assert(page.includes("startRenameLibraryItem"), "Material library should allow asset and folder renaming");
assert(page.includes("commitRenameLibraryItem"), "Material library should commit edited names");
assert(page.includes("保存选择"), "Material library should let users save current selection");
assert(page.includes("单节点或当前选择"), "Node context menu should save a single node or current selection");
assert(page.includes("libraryItems: materialLibraryRef.current"), "Project save payload should include material library items without reload loops");
assert(page.includes("loaded.canvasData.libraryItems"), "Project load should restore material library items");
assert(page.includes('className={materialLibraryOpen ? "selected" : ""} onClick={() => setMaterialLibraryOpen'), "Material library button should live in the left toolbar");
assert(!page.includes('aria-label="撤回删除节点"'), "Bottom undo toolbar button should be removed");
assert(packageJson.includes("check-material-library.mjs"), "npm check should include material library checks");

console.log("Material library checks passed.");
