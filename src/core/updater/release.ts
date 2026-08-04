/**
 * Release Notes Parsing Service
 * Parses markdown release notes from GitHub into structured components
 */

export interface ReleaseNotes {
  features: string[];
  bugFixes: string[];
  improvements: string[];
  knownIssues: string[];
  raw: string;
}

export function parseReleaseNotes(rawNotes: string | undefined | null): ReleaseNotes {
  const result: ReleaseNotes = {
    features: [],
    bugFixes: [],
    improvements: [],
    knownIssues: [],
    raw: rawNotes || "",
  };

  if (!rawNotes) return result;

  const lines = rawNotes.split('\n');
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect headers
    if (trimmed.match(/^#+\s/)) {
      const header = trimmed.replace(/^#+\s/, '').toLowerCase();
      if (header.includes('feature') || header.includes('tính năng')) {
        currentSection = 'features';
      } else if (header.includes('fix') || header.includes('sửa lỗi')) {
        currentSection = 'bugFixes';
      } else if (header.includes('improve') || header.includes('cải thiện') || header.includes('performance')) {
        currentSection = 'improvements';
      } else if (header.includes('issue') || header.includes('lỗi đã biết')) {
        currentSection = 'knownIssues';
      } else {
        currentSection = 'features'; // Default bucket
      }
      continue;
    }

    // Parse list items
    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
      const item = trimmed.substring(1).trim();
      if (item) {
        if (currentSection === 'features') result.features.push(item);
        else if (currentSection === 'bugFixes') result.bugFixes.push(item);
        else if (currentSection === 'improvements') result.improvements.push(item);
        else if (currentSection === 'knownIssues') result.knownIssues.push(item);
      }
    }
  }

  return result;
}
