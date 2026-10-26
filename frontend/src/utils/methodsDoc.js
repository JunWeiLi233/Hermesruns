import { SOURCE_REPOSITORY_URL } from './seoMetadata';

/**
 * Where the formulas are written down: docs/README-ANALYSIS.md on the public repository's default branch. A page that says
 * "worked out from ..." links here, with the anchor of the section that holds the rule (GitHub's own heading anchors).
 */
export const METHODS_DOC_URL = `${SOURCE_REPOSITORY_URL}/blob/master/docs/README-ANALYSIS.md`;

export function methodsDocUrl(anchor) {
  return anchor ? `${METHODS_DOC_URL}#${anchor}` : METHODS_DOC_URL;
}
