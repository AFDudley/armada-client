// ESLint for every tracked JavaScript/TypeScript file (packages/, apps/, scripts/):
// the typescript-eslint recommended set.
import tseslint from "typescript-eslint";

export default tseslint.config(...tseslint.configs.recommended);
