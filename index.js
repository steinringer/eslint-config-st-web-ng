const globals = require('./globals');

// module.exports = {
//     env: {
//         'browser': true,
//         'es6': true
//     },
//     parser: "babel-eslint",
//     extends: [
//         'eslint:recommended',
//         'plugin:angular/johnpapa'
//     ],
//     rules: {
//         'indent': 0,
//         'linebreak-style': 0,
//         'quotes': [
//             'error',
//             'single'
//         ],
//         'semi': [
//             'error',
//             'always'
//         ],
//         'strict': [
//             'error',
//             'function'
//         ],
//         'no-use-before-define': 0,
//         "no-mixed-spaces-and-tabs": 0,
//         'angular/controller-name': [
//             'error',
//             '[a-z][\\w\\.]+Ctrl'
//         ],
//         'angular/file-name': 0,
//         'angular/constant-name': 0,
//         'angular/controller-as-route': 0,
//         'angular/controller-as-vm': 0,
//         'angular/controller-as': 0,
//         'angular/no-controller': 0,
//         'angular/no-inline-template': 0,
//         'angular/no-service-method': 0,
//         'angular/no-services': 0,
//         'angular/prefer-component': 0,
//         'angular/di-unused': 2,
// 		'angular/function-type' : 0
//     },
//     globals
// };


module.exports = {
    env: {
        'browser': true,
        'es6': true,
    },
    extends: ['plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: [
        'eslint-plugin-jsdoc',
        'eslint-plugin-prefer-arrow',
        'eslint-plugin-import',
        '@typescript-eslint'
    ],
    root: true,
    rules: {
        '@typescript-eslint/adjacent-overload-signatures': 'error',
        '@typescript-eslint/array-type': [
            'error',
            {
                'default': 'array'
            }
        ],
        // TODO: Cannot find module
        // '@typescript-eslint/ban-types': [
        //     'error',
        //     {
        //         'types': {
        //             'Object': {
        //                 'message': 'Avoid using the `Object` type. Did you mean `object`?'
        //             },
        //             'Function': {
        //                 'message': 'Avoid using the `Function` type. Prefer a specific function type, like `() => void`.'
        //             },
        //             'Boolean': {
        //                 'message': 'Avoid using the `Boolean` type. Did you mean `boolean`?'
        //             },
        //             'Number': {
        //                 'message': 'Avoid using the `Number` type. Did you mean `number`?'
        //             },
        //             'String': {
        //                 'message': 'Avoid using the `String` type. Did you mean `string`?'
        //             },
        //             'Symbol': {
        //                 'message': 'Avoid using the `Symbol` type. Did you mean `symbol`?'
        //             }
        //         }
        //     }
        // ],
        '@typescript-eslint/consistent-type-assertions': 'error',
        '@typescript-eslint/dot-notation': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-member-accessibility': [
            'error',
            {
                'accessibility': 'no-public'
            }
        ],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/naming-convention': [
            'error',
            {
                'selector': 'variable',
                'format': [
                    'camelCase',
                    'UPPER_CASE',
                    'PascalCase'
                ],
                'leadingUnderscore': 'allow',
                'trailingUnderscore': 'forbid'
            }
        ],
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-empty-interface': 'error',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-misused-new': 'error',
        '@typescript-eslint/no-namespace': 'error',
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/no-shadow': [
            'error',
            {
                'hoist': 'all'
            }
        ],
        '@typescript-eslint/no-unused-expressions': [
            'error',
            {
                'allowShortCircuit': true
            }
        ],
        '@typescript-eslint/no-use-before-define': 'off',
        '@typescript-eslint/no-var-requires': 'off', // need to use require for dynamic imports
        '@typescript-eslint/no-require-imports': 'off', // need to use require for dynamic imports
        '@typescript-eslint/prefer-for-of': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/prefer-namespace-keyword': 'error',
        '@typescript-eslint/triple-slash-reference': [
            'error',
            {
                'path': 'always',
                'types': 'prefer-import',
                'lib': 'always'
            }
        ],
        '@typescript-eslint/typedef': 'off',
        '@typescript-eslint/unified-signatures': 'error',
        'arrow-parens': [
            'off',
            'always'
        ],
        'comma-dangle': 'off',
        'complexity': 'off',
        'constructor-super': 'error',
        'dot-notation': 'off',
        'eqeqeq': [
            'error',
            'smart'
        ],
        'guard-for-in': 'error',
        'id-denylist': [
            'error',
            'any',
            'Number',
            'number',
            'String',
            'string',
            'Boolean',
            'boolean',
            'Undefined',
            'undefined'
        ],
        'id-match': 'error',
        'import/order': [
            'error',
            {
                'alphabetize': {
                    'caseInsensitive': true,
                    'order': 'asc'
                },
                'newlines-between': 'ignore',
                'groups': [
                    [
                        'builtin',
                        'external',
                        'internal',
                        'unknown',
                        'object',
                        'type'
                    ],
                    'parent',
                    [
                        'sibling',
                        'index'
                    ]
                ],
                'distinctGroup': false,
                'pathGroupsExcludedImportTypes': [],
                'pathGroups': [
                    {
                        'pattern': './',
                        'patternOptions': {
                            'nocomment': true,
                            'dot': true
                        },
                        'group': 'sibling',
                        'position': 'before'
                    },
                    {
                        'pattern': '.',
                        'patternOptions': {
                            'nocomment': true,
                            'dot': true
                        },
                        'group': 'sibling',
                        'position': 'before'
                    },
                    {
                        'pattern': '..',
                        'patternOptions': {
                            'nocomment': true,
                            'dot': true
                        },
                        'group': 'parent',
                        'position': 'before'
                    },
                    {
                        'pattern': '../',
                        'patternOptions': {
                            'nocomment': true,
                            'dot': true
                        },
                        'group': 'parent',
                        'position': 'before'
                    }
                ]
            }
        ],
        'jsdoc/check-alignment': 'error',
        'jsdoc/check-indentation': 'error',
        'jsdoc/newline-after-description': 'error',
        'max-classes-per-file': 'off',
        'max-len': 'off',
        'new-parens': 'error',
        'no-bitwise': 'error',
        'no-caller': 'error',
        'no-cond-assign': 'error',
        'no-console': 'error',
        'no-debugger': 'error',
        'no-empty': 'off',
        'no-empty-function': 'off',
        'no-eval': 'error',
        'no-fallthrough': 'off',
        'no-invalid-this': 'off',
        'no-new-wrappers': 'error',
        'no-shadow': 'off',
        'no-throw-literal': 'error',
        'no-trailing-spaces': 'error',
        'no-undef-init': 'error',
        'no-underscore-dangle': 'off',
        'no-unsafe-finally': 'error',
        'no-unused-expressions': 'off',
        'no-unused-labels': 'error',
        'no-use-before-define': 'off',
        'no-var': 'error',
        'object-shorthand': 'error',
        'one-var': [
            'error',
            'never'
        ],
        'prefer-arrow/prefer-arrow-functions': [
            "off", // for now
            {
                "classPropertiesAllowed": true,
                "disallowPrototype": true,
                "singleReturnOnly": false
            }
        ],
        'prefer-const': 'off',
        'radix': 'error',
        'spaced-comment': [
            'error',
            'always',
            {
                'markers': [
                    '/'
                ]
            }
        ],
        'use-isnan': 'error',
        'valid-typeof': 'off',
        'quotes': [
            'error',
            'single'
        ],
        
    },
    globals
};