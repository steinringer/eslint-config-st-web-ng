import hybridPageConvention = require('./rules/hybrid-page-convention');
import gridTypes = require('./rules/grid-types');
import privateConstructorInjection = require('./rules/private-constructor-injection');
import constructorPropertyAccess = require('./rules/constructor-property-access');
import notificationCatchShorthand = require('./rules/notification-catch-shorthand');
import externalTemplate = require('./rules/external-template');
import actionCallbackName = require('./rules/action-callback-name');
import injectionTokenName = require('./rules/injection-token-name');
import componentFileOrder = require('./rules/component-file-order');
import componentMemberOrder = require('./rules/component-member-order');
import hybridTemplateMemberVisibility = require('./rules/hybrid-template-member-visibility');
import hybridPageTemplate = require('./rules/hybrid-page-template');
import hybridSelectorTemplateCase = require('./rules/hybrid-selector-template-case');
import stFormOptions = require('./rules/st-form-options');
import asyncServiceAwait = require('./rules/async-service-await');
import roleFileName = require('./rules/role-file-name');
import hybridInjectTokenType = require('./rules/hybrid-inject-token-type');
import resourceReferences = require('./rules/resource-references');

export = {
    rules: {
        'hybrid-page-convention': hybridPageConvention,
        'grid-types': gridTypes,
        'private-constructor-injection': privateConstructorInjection,
        'constructor-property-access': constructorPropertyAccess,
        'notification-catch-shorthand': notificationCatchShorthand,
        'external-template': externalTemplate,
        'action-callback-name': actionCallbackName,
        'injection-token-name': injectionTokenName,
        'component-file-order': componentFileOrder,
        'component-member-order': componentMemberOrder,
        'hybrid-template-member-visibility': hybridTemplateMemberVisibility,
        'hybrid-page-template': hybridPageTemplate,
        'hybrid-selector-template-case': hybridSelectorTemplateCase,
        'st-form-options': stFormOptions,
        'async-service-await': asyncServiceAwait,
        'role-file-name': roleFileName,
        'hybrid-inject-token-type': hybridInjectTokenType,
        'resource-references': resourceReferences
    }
};
