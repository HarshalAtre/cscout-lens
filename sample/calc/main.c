#include <stdio.h>
#include <stdlib.h>
#include "calc.h"
#include "utils.h"

int main(int argc, char *argv[]) {
    int result;
    
    printf("Simple Calculator\n");
    printf("=================\n\n");
    
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
