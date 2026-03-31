#include <stdio.h>
#include "utils.h"
#include "calc.h"

void print_result(const char *op, int result) {
    printf("%s result: %d\n", op, result);
    if (result > 100) {
        printf("  (Large value detected)\n");
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
    printf("[DEBUG] %s\n", message);
#endif
}
