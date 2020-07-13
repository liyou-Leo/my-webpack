# my-webpack
使用了三个函数：

readcode\ getDependencies\bundle

readcode函数从入口文件开始分析依赖：
如何分析；
找到入口文件entry，从入口文件开始，通过node.js的fs模块读取文件后，使用babylon 解析代码获取 AST。
再通过traverse插件对AST进行访问，进入相关节点，拿到Import导入的文件名，放入依赖数组dependencies = []
通过babel-core将AST转化为ES5的代码
然后
  return {
    id,
    filename,
    dependencies,
    code
  }
这样就完成了对入口文件的分析，拿到入口文件的ES5的代码，和入口文件引入了哪几个文件的依赖数组dependencies

getDependencies利用队列，对依赖项进行递归，先将入口文件分析后的结果放入空数组queue，然后对依赖项（依赖的文件）进行分析，添加进queue数组：
将dependencies中的每一项再进行readcode函数。完成依赖文件的分析后，添加进queue数组
本来qunue数组中只有一个元素，但是对这个元素进行分析的时候，往queue增加了一个元素
所以导致只需要遍历一个元素现在成了还得在往下遍历新加的元素
这样就得到了依赖图

将依赖图谱，包装成立即执行函数：
自定义require\modeule\export
立即执行函数的参数modules：
  // {
  //   id:[ function (module, exports, require) { code } , mapping对象]
  //   id:[ function (module, exports, require) { code } , mapping对象]
  //   id:[ function (module, exports, require) { code } , mapping对象]
  // }
立即执行函数：
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

  // 立即执行函数，其参数是所有的文件构成的对象modules
  // 由于文件的代码中有exports和require，因此要定义好require,module,exports
  // reuqire进行了两层包装
  // require本质上其参数为id，给function(require,module,exports)的reuqire是转换后的localrequire。
  // localrequire会将代码中的相对路径参数，转化为其对应的id（modules[id]），然后执行
  // fn(localRequire, module, module. exports)就是最终的function(require,module,exports)
  // require(0)表示从入口开始执行。每遇到require就会，拿到参数中对应的代码，进行执行
