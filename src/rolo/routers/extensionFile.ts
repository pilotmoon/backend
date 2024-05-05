let _excludeRegex: RegExp;
export function filesExcludeRegex() {
  if (!_excludeRegex) {
    // exclude certain file names in root
    const excludeFileNames = ["readme.md", "demo.gif", "demo.mp4"];
    const regexParts = excludeFileNames.map((name) => `^([^/]+-)?${name}$`);

    // ... and any path with a segment starting with underscore or dot
    regexParts.push("^([^/]+[/])*[_.]");

    _excludeRegex = new RegExp(
      regexParts.map((part) => `(${part})`).join("|"),
      "i",
    );
  }
  return _excludeRegex;
}
