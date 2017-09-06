const redis = require('redis');
 class queue{
   constructor(options){
      let self = this;
      let host = options.host || '127.0.0.1';//主机名称
      let port = options.port || '6379';//端口号
      let db = options.db || '0'
      let opts = {host:host,port:port,db:db};
      if(options.password){
          Object.assign(opts,{password:options.password});//密码
      }
      if(options.redis){
          self.cli = options.redis;
          return self;
      }
      let cli =  redis.createClient(opts);
      cli.on("error",function(err){
        console.log("Redis Error :"+err);
      })
      self.cli = cli;
      self.clientBlocking = cli.duplicate();//开启子进程处理队列任务
      self.multi = cli.multi;//redis事物执行队列
      return self;
   }

   add (list,value,cb){
       if(!list || typeof list != "string" || typeof value === "undefined"){
          if(cb && typeof cb  === "function"){
              return cb('Please enter queue name which you want to push argument and set the value');
          }else{
              return new Promise((resolve,reject)=>{
                  reject('please enter queue name which you want to push argument and set the value');
              })
          }
       }
       return new Promise((resolve,reject)=>{
          this.cli.rpush(list,value,(err,res)=>{
              ( cb && typeof cb  === "function" ) && cb(err,res);
              err && reject(err) || resolve(res);
          })
       })
   }

  //  如果要自动监听队列变化，可以把cb回调函数设置为自身，如果队列中没有数据，则服务刮起，若有变化，则任务继续进行
   shift(list,timeout,cb){
       if(!list || !Array.isArray(list) || list.length === 0 ||  typeof timeout != 'number' || timeout < 0){
          if(cb && typeof cb  === "function"){
            return cb('Please enter queue name which you want to get argument and set the time you want to wait');
          }else{
             return new Promise((resolve,reject)=>{
                 reject('please enter queue name which you want to get argument and set the time you want to wait');
             })
         }
       }
      return new Promise((resolve,reject)=>{
        let argList = [timeout,(err,res)=>{
            ( cb && typeof cb  === "function" ) && cb(err,res);
            err && reject(err) || resolve(res);
        }]
        let allArg = list.concat(argList);
        this.clientBlocking.blpop.apply(this.clientBlocking,allArg);
      })
   }

   shiftMany(list,limit,timeout,cb){
      if(!list || !Array.isArray(list) || list.length === 0 || typeof limit != "number" || limit <= 0 || typeof timeout != 'number' || timeout < 0){
          if(cb && typeof cb  === "function"){
            return cb('Parameters error!Please read the doucument to make sure what parameters you need to provide.');
          }else{
            return new Promise((resolve,reject)=>{
                reject('Parameters error!Please read the doucument to make sure what parameters you need to provide.');
            })
        }
      }
      let Args = [];
      let count = limit;
      let len = list.length;
      let arg = [];
      if(len === 1){
          arg = ["blpop",list[0],timeout];
      }else{
          arg = ["blpop"];
          for (let i= 0; i < len; i++){
             arg.push(list[i]);
          }
          arg.push(timeout);
      }
      for(let i=count ;i >0 ;i--){
        Args.push(arg);
      }
      return new Promise ((resolve,reject)=>{
          this.multi.call(this.cli,Args).exec((err,res)=>{
            ( cb && typeof cb  === "function" ) && cb(err,res);
            err && reject(err) || resolve(res);
          })
      })
   }

  //  订阅发布模式，一旦客户端进入订阅状态,客户端就只可接受订阅相关的命令SUBSCRIBE、PSUBSCRIBE、UNSUBSCRIBE和PUNSUBSCRIBE除了这些命令，其他命令一律失效。
   on(type,cb){
       if(!type || !cb || typeof cb != "function"){
           console.log("please add callback function");
           return;
       }
        this.cli.on(type,(channel, count)=>{
           let obj = {channel:channel,count:count};
            cb(null,obj);
        })
   }

   message(cb){
        if(!cb || typeof cb != "function"){
            console.log("please add callback function");
            return;
        }
        this.cli.on("message",(channel, message)=>{
            let obj = {channel:channel,message:message};
            cb(null,obj)
        })
    }

   sub(channel,cb){
      if(!channel||typeof channel != "string"){
          if(cb && typeof cb  === "function"){
              return cb('Please enter the current type of cannel name!')
          }else{
              return new Promise((resolve,reject)=>{
                  reject('Please enter the current type of cannel name!');
              })
          }
      }
      return new Promise((resolve,reject)=>{
        this.cli.subscribe(channel);
        ( cb && typeof cb  === "function" ) && cb();
        resolve(channel);
      })
   }

   pub(channel,message,cb){
      if( !channel || typeof channel != "string" || typeof message === "undefined"){
            if(cb && typeof cb  === "function"){
                return cb('Please enter the correct cannel name!');
            }else{
                return new Promise((resolve,reject)=>{
                    reject('Please enter the correct cannel name!');
                })
            }
      }
     this.cli.publish(channel,message);
   }

   unsub(channel,cb){
        if(!channel || (typeof channel != 'string' && ! Array.isArray(channel))){
            if(cb && typeof cb === "function"){
                return cb('Please enter the correct cannel name,the cannel format is string or array');
            }
            return new Promise((resolve,reject)=>{
                reject('Please enter the correct cannel name,the cannel format is string or array');
            })
        }
        return new Promise((resolve,reject)=>{
            this.cli.unsubscribe(channel,function(err,channel){
                if(err){
                    ( cb && typeof cb  === "function" ) && cb(err);
                    reject(err);
                }else{
                    ( cb && typeof cb  === "function" ) && cb(null,channel);
                    resolve(channel);
                }
            })
       })
   }

   quit (){
        this.cli.quit();
   }
}

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

module.exports.queue = queue;
module.exports.async = async;