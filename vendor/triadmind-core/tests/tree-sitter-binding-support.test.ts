import test from 'node:test';
import assert from 'node:assert/strict';
import Parser = require('triadmind-tree-sitter');
import TypeScript = require('triadmind-tree-sitter-typescript');
import {
    extractBindingNames,
    extractParameterBindingNames,
    TreeSitterBindingProfile
} from '../treeSitterBindingSupport';

const parser = new Parser();
parser.setLanguage(TypeScript.typescript);

const bindingProfile: TreeSitterBindingProfile = {
    identifierNodes: ['identifier', 'property_identifier', 'shorthand_property_identifier_pattern'],
    memberExpressionNodes: ['member_expression'],
    skipNodeTypes: ['subscript'],
    dedupe: true
};

function parseSource(source: string) {
    return parser.parse(source).rootNode;
}

function findFirstNode(rootNode: Parser.SyntaxNode, nodeType: string): Parser.SyntaxNode {
    const queue: Parser.SyntaxNode[] = [rootNode];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            continue;
        }
        if (current.type === nodeType) {
            return current;
        }
        queue.push(...current.namedChildren);
    }

    throw new Error(`Node type not found: ${nodeType}`);
}

test('extractBindingNames keeps only local bindings from object destructuring', () => {
    const rootNode = parseSource('const { foo: bar, nested: { qux }, baz } = payload;');
    const declarator = findFirstNode(rootNode, 'variable_declarator');
    const nameNode = declarator.childForFieldName('name');

    assert.ok(nameNode);
    assert.deepEqual(extractBindingNames(nameNode, bindingProfile).sort(), ['bar', 'baz', 'qux']);
});

test('extractParameterBindingNames unwraps parameter patterns without property labels', () => {
    const rootNode = parseSource('function handle({ foo: bar, nested: { qux }, baz }, primary) {}');
    const functionNode = findFirstNode(rootNode, 'function_declaration');
    const parametersNode = functionNode.childForFieldName('parameters');

    assert.ok(parametersNode);
    assert.deepEqual(extractParameterBindingNames(parametersNode, bindingProfile).sort(), ['bar', 'baz', 'primary', 'qux']);
});

test('extractBindingNames ignores member expressions as binding roots', () => {
    const rootNode = parseSource('const alias = source.value;');
    const declarator = findFirstNode(rootNode, 'variable_declarator');
    const valueNode = declarator.childForFieldName('value');

    assert.ok(valueNode);
    assert.deepEqual(extractBindingNames(valueNode, bindingProfile), []);
});
