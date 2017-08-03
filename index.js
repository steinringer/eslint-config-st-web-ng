module.exports = {
    env: {
        'browser': true,
        'es6': false
    },
    extends: [
        'eslint:recommended',
        'plugin:angular/johnpapa'
    ],
    rules: {
        'indent': 0,
        'linebreak-style': 0,
        'quotes': [
            'error',
            'single'
        ],
        'semi': [
            'error',
            'always'
        ],
        'strict': [
            'error',
            'function'
        ],
        'no-use-before-define': 0,
        'angular/controller-name': [
            'error',
            '[a-z][\\w\\.]+Ctrl'
        ],
        'angular/file-name': 0,
        'angular/constant-name': 0,
        'angular/controller-as-route': 0,
        'angular/controller-as-vm': 0,
        'angular/controller-as': 0,
        'angular/no-controller': 0,
        'angular/no-inline-template': 0,
        'angular/no-service-method': 0,
        'angular/no-services': 0,
        'angular/prefer-component': 0
    },
    globals: {
        angular: true,
        _: true,
        d3: true,
        $: true,
        Notification: true,
        LocalizationProvider: true,
        JL: true,
        H: true,
        ModuleRegister: true,
        PDFJS: true,
        PackageData: true,
        GroupPackages: true,
        ScrollHandler: true,
        Snap: true,
        UrlCreator: true,
        removeResizeListener: true,
        addResizeListener: true,
        tinyMCE: true
    }
};