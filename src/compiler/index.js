/* @flow */

import { parse } from './parser/index' // 解析器
import { optimize } from './optimizer' // 优化器
import { generate } from './codegen/index' // 代码生成器
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.

// 创建编译器
// baseCompile 是 模板编译三大阶段的主函数
export const createCompiler = createCompilerCreator(function baseCompile (
  template: string,
  options: CompilerOptions
): CompiledResult {
  // 模板解析阶段：用正则等方式解析 template 模板中的指令、class、style等数据，形成AST
  const ast = parse(template.trim(), options)
  if (options.optimize !== false) {
    // 优化阶段：遍历AST，找出其中的静态节点，并打上标记；
    // optimize 的主要作用是标记静态节点，这是 Vue 在编译过程中的一处优化，
    // 挡在进行patch 的过程中， DOM-Diff 算法会直接跳过静态节点，从而减少了比较的过程，优化了 patch 的性能。
    optimize(ast, options)
  }
  // 代码生成阶段：将AST转换成渲染函数；
  // 将 AST 转化成 render函数字符串的过程，
  // 得到结果是 render函数 的字符串以及 staticRenderFns 字符串
  const code = generate(ast, options)
  // 最终返回了抽象语法树( ast )，渲染函数( render )，静态渲染函数( staticRenderFns )
  return {
    ast,
    render: code.render,
    staticRenderFns: code.staticRenderFns
  }
})
