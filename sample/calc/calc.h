#ifndef CALC_H
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

#endif
