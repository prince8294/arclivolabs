import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function tagName(node) {
  return node.tagName?.getText() ?? '';
}

function attributes(node) {
  const values = new Map();
  let hasSpread = false;
  for (const property of node.attributes.properties) {
    if (ts.isJsxSpreadAttribute(property)) {
      hasSpread = true;
      continue;
    }
    const name = property.name.getText();
    let value = true;
    if (property.initializer && ts.isStringLiteral(property.initializer)) value = property.initializer.text;
    values.set(name, value);
  }
  return { values, hasSpread };
}

function insideActionForm(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const name = tagName(current.openingElement);
      if (name === 'form' || name === 'ActionForm') return true;
    }
    current = current.parent;
  }
  return false;
}

function hasFormAncestor(node) {
  // A JSX opening element's immediate parent is the JSX element that owns
  // that same opening tag. Skip it so a form is not reported as its own
  // ancestor. Self-closing components already point at their real parent.
  let current = ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent)
    ? node.parent.parent
    : node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const name = tagName(current.openingElement);
      if (name === 'form' || name === 'ActionForm') return true;
    }
    current = current.parent;
  }
  return false;
}

const findings = [];
for (const file of walk('src').filter((entry) => entry.endsWith('.tsx'))) {
  const source = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function report(node, message) {
    const line = tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
    findings.push({ file: file.replaceAll('\\', '/'), line, message });
  }

  function visit(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node);
      const { values, hasSpread } = attributes(node);
      if ((tag === 'Link' || tag === 'ButtonLink') && !values.has('href') && !hasSpread) {
        report(node, `${tag} has no href`);
      }
      if (tag === 'button' || tag === 'Button') {
        const explicitType = values.get('type');
        const hasHandler = values.has('onClick') || values.has('formAction');
        const intentionallyDisabled = values.has('disabled');
        const submitsForm = explicitType === 'submit' || (!explicitType && insideActionForm(node));
        if (!hasSpread && !hasHandler && !intentionallyDisabled && !submitsForm) {
          report(node, `${tag} has no handler and is not a form submit control`);
        }
      }
      if ((tag === 'form' || tag === 'ActionForm') && hasFormAncestor(node)) {
        report(node, `${tag} is nested inside another form`);
      }
      // A GET form without an explicit action intentionally submits to the
      // current URL, which is how list filters update their search params.
    }
    ts.forEachChild(node, visit);
  }

  visit(tree);
}

console.log(JSON.stringify({ checkedFiles: walk('src').filter((file) => file.endsWith('.tsx')).length, findings }, null, 2));
process.exitCode = findings.length ? 1 : 0;
