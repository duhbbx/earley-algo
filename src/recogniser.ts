interface EarleyItem {
    rule: number;   // 语法规则在语法中的索引
    next: number;   // 规则中下一个要处理的符号的索引
    start: number;  // 输入中规则开始应用的位置
}

interface GrammarRule {
    name: string;

    // ts 太牛逼了,这种类型也可以定义吗
    [index: number]: string | ((input: string, index: number) => boolean);
}

interface Grammar {
    start_rule_name: string;
    [index: number]: GrammarRule | string;
}

type EarleySet = EarleyItem[][];

const earleyItem = (rule: number, next: number, start: number): EarleyItem => ({
    rule,
    next,
    start
});


// 这个是定义的规则
const exampleGrammar: Grammar = {
    
    start_rule_name: 'Sum', // 起始的规则名称是 Sum
    0: { name: 'Sum', 0: 'Sum', 1: classSymbol('+-'), 2: 'Product' },
    1: { name: 'Sum', 0: 'Product' },
    2: { name: 'Product', 0: 'Product', 1: classSymbol('*/'), 2: 'Factor' },
    3: { name: 'Product', 0: 'Factor' },
    4: { name: 'Factor', 0: charSymbol('('), 1: 'Sum', 2: charSymbol(')') },
    5: { name: 'Factor', 0: 'Number' },
    6: { name: 'Number', 0: rangeSymbol('09'), 1: 'Number' },
    7: { name: 'Number', 0: rangeSymbol('09') }
};

// Utility functions for terminal symbols
function charSymbol(c: string): (input: string, index: number) => boolean {
    return (input, index) => input.charAt(index) === c;
}

function rangeSymbol(r: string): (input: string, index: number) => boolean {
    return (input, index) => {
        const code = input.charCodeAt(index);
        return code >= r.charCodeAt(0) && code <= r.charCodeAt(1);
    };
}

function classSymbol(c: string): (input: string, index: number) => boolean {
    return (input, index) => c.includes(input.charAt(index));
}

// Main Earley parsing functions
function nextSymbol(grammar: Grammar, item: EarleyItem): string | ((input: string, index: number) => boolean) | undefined {
    return grammar[item.rule][item.next];
}

function getRuleName(grammar: Grammar, item: EarleyItem): string {
    return (grammar[item.rule] as GrammarRule).name;
}

function equal(item1: EarleyItem, item2: EarleyItem): boolean {
    return item1.rule === item2.rule && item1.start === item2.start && item1.next === item2.next;
}

function append(set: EarleyItem[], item: EarleyItem): void {
    for (let i = 0; i < set.length; i++) {
        if (equal(set[i], item)) return;
    }
    set.push(item);
}

function complete(S: EarleySet, i: number, j: number, grammar: Grammar): void {
    const item = S[i][j];
    for (const oldItem of S[item.start]) {
        if (nextSymbol(grammar, oldItem) === getRuleName(grammar, item)) {
            append(S[i], { rule: oldItem.rule, next: oldItem.next + 1, start: oldItem.start });
        }
    }
}

function scan(S: EarleySet, i: number, j: number, symbol: (input: string, index: number) => boolean, input: string): void {
    const item = S[i][j];
    if (symbol(input, i)) {
        if (!S[i + 1]) S[i + 1] = [];
        append(S[i + 1], { rule: item.rule, next: item.next + 1, start: item.start });
    }
}

function predict(S: EarleySet, i: number, symbol: string, grammar: Grammar): void {
    for (let ruleIndex = 0; ruleIndex < Object.keys(grammar).length; ruleIndex++) {
        const rule = grammar[ruleIndex] as GrammarRule;
        if (rule.name === symbol) {
            append(S[i], { rule: ruleIndex, next: 1, start: i });
        }
    }
}

function buildItems(grammar: Grammar, input: string): EarleySet {
    const S: EarleySet = [[]];
    for (let i = 0; i < Object.keys(grammar).length; i++) {
        const rule = grammar[i] as GrammarRule;
        if (rule.name === grammar.start_rule_name) {
            append(S[0], { rule: i, start: 0, next: 0 });
        }
    }

    let i = 0;
    while (i < S.length) {
        let j = 0;
        while (j < S[i].length) {
            const symbol = nextSymbol(grammar, S[i][j]);
            if (symbol === undefined) {
                complete(S, i, j, grammar);
            } else if (typeof symbol === 'function') {
                scan(S, i, j, symbol, input);
            } else if (typeof symbol === 'string') {
                predict(S, i, symbol, grammar);
            } else {
                throw new Error('illegal rule');
            }
            j++;
        }
        i++;
    }
    return S;
}

// Test utilities
function hasPartialParse(S: EarleySet, i: number, grammar: Grammar): boolean {
    const set = S[i];
    for (const item of set) {
        const rule = grammar[item.rule] as GrammarRule;
        if (rule.name === grammar.start_rule_name && item.next > Object.keys(rule).length - 1 && item.start === 0) {
            return true;
        }
    }
    return false;
}

function hasCompleteParse(S: EarleySet, grammar: Grammar): boolean {
    return hasPartialParse(S, S.length - 1, grammar);
}

function lastPartialParse(S: EarleySet, grammar: Grammar): number | null {
    for (let i = S.length - 1; i >= 0; i--) {
        if (hasPartialParse(S, i, grammar)) return i;
    }
    return null;
}

function diagnose(S: EarleySet, grammar: Grammar, input: string): void {
    if (hasCompleteParse(S, grammar)) {
        console.log('The input has been recognised. Congratulations!');
    } else {
        if (S.length === input.length + 1) {
            console.log('The whole input made sense. Maybe it is incomplete?');
        } else {
            console.log('The input stopped making sense at character', S.length - 1);
        }
        const lpp = lastPartialParse(S, grammar);
        if (lpp !== null) {
            console.log('This beginning of the input has been recognised:', input.substring(0, lpp));
        } else {
            console.log("The beginning of the input couldn't be parsed.");
        }
    }
}

// Pretty printer
class PrettyPrinter {
    private lines: string[][] = [];

    write(...args: any[]): void {
        const line = this.lines[this.lines.length - 1];
        if (!line) return;
        line[line.length - 1] += args.join(' ');
    }

    col(): void {
        const line = this.lines[this.lines.length - 1];
        if (!line) return;
        line.push('');
    }

    line(): void {
        this.lines.push(['']);
    }

    print(indent = 0): void {
        const maxCols = this.lines.reduce((max, line) => Math.max(max, line.length), 0);
        const colWidths = Array(maxCols).fill(0);

        for (const line of this.lines) {
            line.forEach((col, i) => {
                colWidths[i] = Math.max(colWidths[i], col.length);
            });
        }

        for (const line of this.lines) {
            process.stdout.write(' '.repeat(indent));
            line.forEach((col, i) => {
                process.stdout.write(col + ' '.repeat(colWidths[i] - col.length));
            });
            console.log();
        }
    }
}

// Print all Earley items
function printS(S: EarleySet, grammar: Grammar): void {
    for (let i = 0; i < S.length; i++) {
        console.log(`    === ${i} ===`);
        const pp = new PrettyPrinter();
        for (const st of S[i]) {
            pp.line();
            pp.col();
            pp.write(getRuleName(grammar, st));
            pp.col();
            pp.write(' ->');
            for (let k = 0; k < Object.keys(grammar[st.rule]).length; k++) {
                const symbol = (grammar[st.rule] as GrammarRule)[k];
                if (k === st.next) pp.write(' •');
                if (typeof symbol === 'string') pp.write(' ', symbol);
                else if (typeof symbol === 'function') pp.write(' ', symbol);
            }
            if (st.next > Object.keys(grammar[st.rule]).length - 1) pp.write(' •');
            pp.col();
            pp.write(`  (${st.start})`);
        }
        pp.print(4);
        console.log();
    }
}

// Sample input and usage
const input = '1+(2*3+4)'; // Tinker with this first.
const S = buildItems(exampleGrammar, input);
console.log('Input:', input); // print the input
printS(S, exampleGrammar);    // print all the internal state
diagnose(S, exampleGrammar, input); // tell if the input is OK or not
