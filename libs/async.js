class async{
  constructor(){

  }
  eachLimit(arr,limit,method,callback){
      let count = limit;
      let Arr = arr;
      let Len = Arr.length;
      // let iterateeCallback = method;
      let running = 0;//正在运行的程序数量
      let index = 0;//数组元素的索引
      let done = false;//所有程序是否执行完成
      if(limit <= 0){
          return callback("The limit must be greater than 0");
      }
      if(!arr || !Array.isArray(arr)){
          return callback("The coll must be a array");
      }

      function iterateeCallback(err){
             running -= 1;
             if(err){
                 done = true;
                 callback(err);
             }else if(done && running <= 0 && index >= Len){
                 return callback(null);
             }else{
                 replenish();
             }
      }

      function replenish(){
          while(running < limit && !done){
              if(index >= Len){
                 done = true;
                 if(running <= 0){
                     callback(null);
                 }
                 return;
              }
              let elem = Arr[index];
              let itemIndex = index;
              index += 1;
              running +=1;
              method(elem,itemIndex,iterateeCallback);
          }
      }

      replenish();
  }
}

module.exports = async;