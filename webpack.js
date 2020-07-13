// 文件读取模块和路径模块，是node.js自带的系统模块
const fs = require('fs')
const path = require('path')

// 解析成AST
const babylon = require('babylon')
// 对AST节点进行操作
const traverse = require('babel-traverse').default
//ES6转换ES5的插件
const { transformFromAst } = require('babel-core')

let ID = 0

// filename是entry相对路径
function createAsset(filename){

  // readFileSync表示同步读取,不写"utf-8"编码格式则读取出来的是二进制码
  const content = fs.readFileSync(filename, "utf-8")

  // 打印出来了index.js里面的代码（打印里面的代码内容，不是执行代码）
  // console.log(content)

  //将ES6解析成抽象语法树， babylon.parse默认无法解析ES6的模块化代码,需要设置sourcetype
  const ast  = babylon.parse(content,{

    sourceType:"module"

  })

  // 拿到了解析后的抽象语法树
  // console.log(ast )

  // 寻找当前文件的依赖关系
  const dependencies = []
  // ast中，每个节点的node.source.value的值就是import导入的文件名，这个就是依赖关系
  // traverse对AST进行访问，进入相关节点
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      // dependencies中就拿到了入口文件中导如的文件名
      dependencies.push(node.source.value)
    }
  })

  // console.log(dependencies)

  // 通过 AST 将代码转为 ES5
  const { code } = transformFromAst(ast, null, {
    presets: ['env']
  })

  // 拿到了ES5的代码
  // console.log(code )

  id = ID++
  return {
    id,
    filename,
    dependencies,
    code
  }

}

// 拿到了返回的对象
// const assets = concreateAsset("./src/index.js")

function createGraph (entry){

  // mainAsset是个对象，入口文件的分析结果
  const mainAsset = createAsset(entry)

  // 利用队列，对依赖项进行递归
  const queue = [mainAsset]


  for (const asset of queue){

    asset.mapping = {}

    // 拿到入口文件的绝对路径
    const dirname = path.dirname(asset.filename)

    // 对入口文件的依赖项进行遍历, relativePath为依赖项的相对路径
    asset.dependencies.forEach(relativePath =>{

      // 拿到入口文件的每一个依赖项的绝对路径
      const absoluePath = path.join(dirname, relativePath)

      // child是个对象，是对入口文件的依赖项的分析结果
      const child = createAsset(absoluePath)  

      // mapping属性保存着自己的依赖项，和其对应的id
      asset.mapping[relativePath] = child.id

      // 本来队列中只有一个入口文件的分析
      // 现在队列增加了一个新的选项，因此还得再遍历，达到了递归的效果
      queue.push(child)
      // 本来qunue数组中只有一个元素，但是对这个元素进行分析的时候，往queue增加了一个元素
      // 所以导致只需要遍历一个元素现在成了还得在往下遍历新加的元素

    })

    // 入口文件只有一个依赖项：会依次进行找寻，然后push到queue中
    // 入口文件有多个依赖项：会对第一个先进行分析，向下深层次进行找寻，然后push到queue中
    // 第一个的完全找完了，才会找第二个的，加入queue数组中
    // 最后，数组里面一个一个的对象

  }

  return queue

}

const graph = createGraph ("./src/index.js")

// console.log(graph)

// 打包，构建common.js的exports和require的规范
// 将queue数组中的所有元素（分析好的文件），合成一个文件
// 立即调用表达式
function  bundle(graph){

  let modules = '';

  // 将graph数组的每一个元素（文件分析），改造成对象的形式
  // {
  //   id:[function（code） , mapping对象]
  //   id:[function（code） , mapping对象]
  //   id:[function（code） , mapping对象]
  // }
  // 最后会将这个对象作为参数，传递给总的立即执行函数

  // id为对象属性名，其值是个数组，数组里面放着两样东西，
  // 第一个元素是个函数，函数里面放了真正要执行的文件代码
  // 第二个元素是个对象，放着该文件的依赖项和依赖项对应的id
  graph.forEach((mod =>{

    // 文件代码中有require,module,exports，因此把这个代码放到一个函数中，函数的参数为require,module,exports
    // 将代码放到function(require,module,exports){}中，这样require,module,exports就有定义了
    // 然后在想办法定义好require,module,exports
    modules += `
      ${mod.id}:[
        function(require,module,exports){
          ${mod.code}
        },
        ${JSON.stringify(mod.mapping)}
      ],
    `

  }))

  // 立即执行函数，其参数是所有的文件构成的对象modules
  // 由于文件的代码中有exports和require，因此要定义好require,module,exports
  // reuqire进行了两层包装
  // require本质上其参数为id，给function(require,module,exports)的reuqire是转换后的localrequire。
  // localrequire会将代码中的相对路径参数，转化为其对应的id（modules[id]），然后执行
  // fn(localRequire, module, module. exports)就是最终的function(require,module,exports)
  // require(0)表示从入口开始执行。每遇到require就会，拿到参数中对应的代码，进行执行
  const result = `
    (function(modules){

      function require(id){

        const [fn, mapping] = modules[id]; 

        function localRequire(relativePath){
          return require(mapping[relativePath]); 
        }

        const module={
          exports:{}
        }

        fn(localRequire, module, module.exports)

        return module.exports
        
      }

      require(0);

    })({${modules}})
  `;

  return result 

}

const result = bundle(graph)

console.log(result)

