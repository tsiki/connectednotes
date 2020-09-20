
declare interface ProgrammingLanguage {
    mimeType: string;
    selectors: string[];
}

// When adding languages, also import the corresponding file in editor.ts
export const PROGRAMMING_LANGUAGES: ProgrammingLanguage[] = [
    {
        mimeType: 'text/javascript',
        selectors: [ 'javascript', 'js' ]
    },
    {
        mimeType: 'text/typescript',
        selectors: [ 'typescript', 'ts' ]
    },
    {
        mimeType: 'text/x-csrc',
        selectors: [ 'c' ]
    },
    {
        mimeType: 'text/x-c++src',
        selectors: [ 'c++', 'cpp' ]
    },
    {
        mimeType: 'text/x-c++src',
        selectors: [ 'c++', 'cpp' ]
    },
    {
        mimeType: 'text/x-csharp',
        selectors: [ 'c#', 'csharp' ]
    },
    {
        mimeType: 'text/x-clojure',
        selectors: [ 'clojure' ]
    },
    {
        mimeType: 'text/x-elm',
        selectors: [ 'elm' ]
    },
    {
        mimeType: 'text/x-java',
        selectors: [ 'java' ]
    },
    {
        mimeType: 'text/x-kotlin',
        selectors: [ 'kotlin', 'kt' ]
    },
    {
        mimeType: 'text/x-haskell',
        selectors: [ 'haskell', 'hs' ]
    },
    {
        mimeType: 'text/x-objectivec',
        selectors: [ 'objective-c', 'objectivec', 'objc' ]
    },
    {
        mimeType: 'text/x-scala',
        selectors: [ 'scala' ]
    },
    {
        mimeType: 'text/x-css',
        selectors: [ 'css' ]
    },
    {
        mimeType: 'text/x-scss',
        selectors: [ 'scss' ]
    },
    {
        mimeType: 'text/x-less',
        selectors: [ 'less' ]
    },
    {
        mimeType: 'text/x-html',
        selectors: [ 'html' ]
    },
    {
        mimeType: 'text/x-markdown',
        selectors: [ 'markdown', 'md' ]
    },
    {
        mimeType: 'text/x-xml',
        selectors: [ 'xml' ]
    },
    {
        mimeType: 'text/x-stex',
        selectors: [ 'latex', 'tex' ]
    },

    {
        mimeType: 'text/x-php',
        selectors: [ 'php' ]
    },
    {
        mimeType: 'text/x-python',
        selectors: [ 'python', 'py' ]
    },
    {
        mimeType: 'text/x-rsrc',
        selectors: [ 'r' ]
    },
    {
        mimeType: 'text/x-ruby',
        selectors: [ 'ruby', 'rb' ]
    },
    {
        mimeType: 'text/x-sql',
        selectors: [ 'sql' ]
    },
    {
        mimeType: 'text/x-swift',
        selectors: [ 'swift' ]
    },
    {
        mimeType: 'text/x-sh',
        selectors: [ 'shell', 'sh', 'bash' ]
    },
    {
        mimeType: 'text/x-vb',
        selectors: [ 'vb', 'visualbasic' ]
    },
    {
        mimeType: 'text/x-yaml',
        selectors: [ 'yaml', 'yml' ]
    },
    {
        mimeType: 'text/x-go',
        selectors: [ 'go' ]
    },
    {
        mimeType: 'text/x-rust',
        selectors: [ 'rust', 'rs' ]
    },
    {
        mimeType: 'text/x-julia',
        selectors: [ 'julia', 'jl' ]
    },
    {
        mimeType: 'text/x-tcl',
        selectors: [ 'tcl' ]
    },
    {
        mimeType: 'text/x-scheme',
        selectors: [ 'scheme' ]
    },
    {
        mimeType: 'text/x-common-lisp',
        selectors: [ 'commonlisp', 'clisp' ]
    },
    {
        mimeType: 'text/x-powershell',
        selectors: [ 'powershell' ]
    },
    {
        mimeType: 'text/x-stsrc',
        selectors: [ 'smalltalk', 'st' ]
    },
];
