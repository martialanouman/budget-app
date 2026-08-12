import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: ['pb_public/**', '**/dist/**', '**/__screenshots__/**', 'pb_hooks/lib/**'],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['frontend/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // TanStack Router signals a redirect by throwing a plain object, by design.
    files: ['frontend/src/router.tsx'],
    rules: {
      '@typescript-eslint/only-throw-error': 'off',
    },
  },
  {
    files: ['**/*.config.{js,ts}', 'packages/domain/build.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // PocketBase runs these in its own JS VM: no bundler, no TypeScript
    // project, and a set of injected globals.
    files: ['pb_migrations/**/*.js', '**/pb_hooks/**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: {
      // goja loads CommonJS only; require is the sole way in.
      '@typescript-eslint/no-require-imports': 'off',
    },
    languageOptions: {
      globals: {
        require: 'readonly',
        $app: 'readonly',
        $apis: 'readonly',
        $os: 'readonly',
        $security: 'readonly',
        __hooks: 'readonly',
        migrate: 'readonly',
        cronAdd: 'readonly',
        routerAdd: 'readonly',
        Collection: 'readonly',
        Record: 'readonly',
        BoolField: 'readonly',
        DateField: 'readonly',
        FileField: 'readonly',
        JSONField: 'readonly',
        NumberField: 'readonly',
        RelationField: 'readonly',
        SelectField: 'readonly',
        TextField: 'readonly',
        onRecordCreate: 'readonly',
        onRecordCreateRequest: 'readonly',
        onRecordUpdate: 'readonly',
        onRecordDelete: 'readonly',
        onRecordAfterCreateSuccess: 'readonly',
        onRecordAfterUpdateSuccess: 'readonly',
        onRecordAfterDeleteSuccess: 'readonly',
      },
    },
  },
  prettier,
)
