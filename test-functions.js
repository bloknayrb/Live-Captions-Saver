// Test key functions with sample data
function normalizeText(text) {
    if (!text) return '';
    let cleaned = text;
    cleaned = cleaned.replace(/&[a-zA-Z0-9#]+;/g, ' ');
    cleaned = cleaned.replace(/\s+/g, ' ');
    cleaned = cleaned.replace(/\.\.\./g, '');
    cleaned = cleaned.replace(/^\s*[\.\-\*\>\<\|\~\+\=]+\s*/g, '');
    cleaned = cleaned.replace(/\s*[\.\-\*\>\<\|\~\+\=]+\s*$/g, '');
    cleaned = cleaned.replace(/\[.*?\]/g, '');
    cleaned = cleaned.replace(/\(typing\)/gi, '');
    cleaned = cleaned.replace(/\(speaking\)/gi, '');
    cleaned = cleaned.replace(/\s*([,.!?;:])\s*/g, '$1 ');
    cleaned = cleaned.trim();
    return cleaned;
}

function createCaptionKey(name, text) {
    const normalizedName = name ? name.trim() : 'Unknown Speaker';
    const normalizedText = normalizeText(text);
    return `${normalizedName}:${normalizedText}`;
}

// Test cases
console.log('🧪 FUNCTION TESTS:');
console.log('==================');

// Test text normalization
const testTexts = [
    '  Hello   world...  ',
    'Text (typing) more text',
    '[noise] Real content &nbsp; here',
    '...Leading symbols and trailing...'
];

console.log('📝 Text Normalization:');
testTexts.forEach((text, i) => {
    const result = normalizeText(text);
    console.log(`  ${i+1}. "${text}" → "${result}"`);
});

// Test key generation
console.log('\n🔑 Key Generation:');
const speakers = ['John Doe', 'Jane Smith', '  Spaced Name  '];
const texts = ['Hello world', '  Hello   world  ', 'Hello world...'];

speakers.forEach(speaker => {
    texts.forEach(text => {
        const key = createCaptionKey(speaker, text);
        console.log(`  "${speaker}" + "${text}" → "${key}"`);
    });
});

console.log('\n✅ Function tests completed successfully!');