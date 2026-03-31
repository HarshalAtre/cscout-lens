// Auto-setup script for CScout-Lens improvements
// Run with: node create-all-files.js

const fs = require('fs');
const path = require('path');

// Helper to create file with directory
function createFile(filePath, content) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Created file: ${filePath}`);
}

console.log('Creating all CScout-Lens improvement files...\n');

// Sample C files
createFile('sample/calc/main.c', `#include <stdio.h>
#include <stdlib.h>
#include "calc.h"
#include "utils.h"

int main(int argc, char *argv[]) {
    int result;
    
    printf("Simple Calculator\\n");
    printf("=================\\n\\n");
    
    result = calc_add(10, 5);
    print_result("Addition", result);
    
    result = calc_sub(10, 5);
    print_result("Subtraction", result);
    
    result = calc_mul(10, 5);
    print_result("Multiplication", result);
    
    result = calc_div(10, 5);
    print_result("Division", result);
    
    return 0;
}
`);

createFile('sample/calc/calc.c', `#include "calc.h"

int calc_add(int a, int b) {
    return a + b;
}

int calc_sub(int a, int b) {
    return a - b;
}

int calc_mul(int a, int b) {
    return a * b;
}

int calc_div(int a, int b) {
    if (b == 0) {
        return 0;  // Error: division by zero
    }
    return a / b;
}
`);

createFile('sample/calc/calc.h', `#ifndef CALC_H
#define CALC_H

#define MAX_BUF 256
#define EPSILON 0.0001
#define DEBUG_MODE 0

typedef struct {
    double value;
    int error_code;
} CalcResult;

typedef enum {
    OP_ADD,
    OP_SUB,
    OP_MUL,
    OP_DIV
} calc_op_t;

int calc_add(int a, int b);
int calc_sub(int a, int b);
int calc_mul(int a, int b);
int calc_div(int a, int b);

#endif /* CALC_H */
`);

createFile('sample/calc/utils.c', `#include <stdio.h>
#include "utils.h"
#include "calc.h"

void print_result(const char *op, int result) {
    printf("%s result: %d\\n", op, result);
    if (result > 100) {
        printf("  (Large value detected)\\n");
    }
}

static int parse_input(const char *input) {
    int value = 0;
    int i = 0;
    
    while (input[i] >= '0' && input[i] <= '9') {
        value = value * 10 + (input[i] - '0');
        i++;
    }
    
    return value;
}

static void format_output(char *buffer, int value) {
    sprintf(buffer, "Result: %d", value);
}

static void debug_log(const char *message) {
    #if DEBUG_MODE
    printf("[DEBUG] %s\\n", message);
    #endif
}
`);

createFile('sample/calc/utils.h', `#ifndef UTILS_H
#define UTILS_H

#include "calc.h"

void print_result(const char *op, int result);

#endif /* UTILS_H */
`);

console.log('\n✓ Sample C files created!');
console.log('\nNext: Run "npm install" if you haven\'t already');
console.log('Then I\'ll create the TypeScript implementation files.');
