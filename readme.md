# Steinringer angular ESlint configuration

ESlint config for angular web development at Steinringer WEB and IT solutions

## Install
```sh
npm install --save-dev eslint @steinringer/eslint-config-st-web-ng
```

install also `gulp-eslint` in case of usage with gulp

```sh
npm install --save-dev eslint @steinringer/eslint-config-st-web-ng gulp-eslint
```

Extend in ```.eslintrc.json``` file 
```json
{
  "extends": "@steinringer/st-web-ng"
}
```

## Local Portego convention trial

The config enables source-file checks for component order, role filenames, forms,
grids, interfaces, hybrid constructor injections, and error-handler shorthand.
Additional page-layout and template rules are available in the plugin but are
not enabled by this config. Filename checks use registration JSON to identify
hybrid pages. Install both local packages in a module
while testing; the config declares the plugin as a peer dependency.

The optional page rule uses literal `route.component` values in the owning
package's `Configuration/Packages/<Module>` JSON files. It skips unregistered
components and dynamic routes. Optional template rules check the page wrapper
and `$ctrl` access in hybrid templates. The external-template rule checks only
that a literal relative `templateUrl` points to an existing file. Templates
may be shared; it does not enforce placement or matching basenames.

Run `npm test` here before packing. The repository-level checker remains a local
experiment in `bin/`; it is not shipped as part of this ESLint config package.
Bootstrap exclusions need the actual Gulp glob behavior and are not checked by ESLint.
The grid rule needs the module's `tsconfig.json` for type information.
It checks direct `$ctrl.options` bindings, not nested expressions such as
`$ctrl.options.NormalOptions`.

Interface prefixes use the standard `@typescript-eslint/naming-convention` rule.
Remove explicit `portego/interface-prefix` entries when updating this local trial;
that custom rule was removed. Component files use the Portego member-order rule
instead of also running standard member ordering. Repeated members in one
misplaced group produce one warning.

Injection checks resolve the hybrid decorator's lexical binding. Catch shorthand
requires the standard Promise method and the resolved notification handler.
Template visibility skips literal and rebound controller scopes; route-only
outlets do not have to own page layout. Unresolved evidence is not a violation.
Resource-key casing is not checked: the convention and the current browser
serializer disagree. The optional resource rule still checks placeholder values
and resolved resource-class names. It does not ask callers to change key casing.
Repeat-start/end blocks preserve their controller scope. A template that assigns
the `$ctrl` alias is skipped because that assignment can affect sibling bindings.
Both `.ajs.component.ts` and `.component.ajs.ts` framework markers are accepted.
The filename rule also checks the suffix of registered hybrid pages. The page
rule checks placement and selectors; it does not duplicate filename diagnostics.

The research CLI reports project-evaluation failures and unresolved Jobs ownership
as `[unresolved]`, not as convention violations. Its `--strict` exit code is 2
for an incomplete run, 1 for violations, and 0 otherwise. Programmatic callers
can pass an unresolved-message callback as the third argument to `validate`.

The optional `async-service-await` rule reports direct discarded Promise-like
calls inside the wrapper. It does not track stored promises or branch ownership.
Use standard promise checks for broader coverage where their scope is suitable.
