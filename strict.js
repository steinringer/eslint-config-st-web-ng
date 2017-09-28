const globals = require('./globals');

module.exports = {
    env: {
        'browser': true,
        'es6': false
    },
    extends: [
        'eslint:recommended',
    ],
    rules: {
        "indent": 0,
        "linebreak-style": 0,
        "quotes": 0,
        "semi": 0,
        "strict": 0,
        "no-use-before-define": 0,
        "no-mixed-spaces-and-tabs": 0,
        "no-unused-vars": 0,
        "no-console": 0,
        "no-useless-escape": 0,
        "no-extra-semi": 0,
        "no-redeclare": 0
    },
    globals
};