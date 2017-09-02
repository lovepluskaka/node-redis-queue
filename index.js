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
   onsub(channel,cb){
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
           this.cli.on("subscribe",(channel, count)=>{
                ( cb && typeof cb  === "function" ) && cb(channel, count);
                resolve(channel, count);
           })
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
      })
   }

   pub(channel,message,cb){
      if( !channel || typeof channel != "string" || typeof message === "undefined"){
            if(cb && typeof cb  === "function"){
                return cb('Please enter the correct cannel name!')
            }else{
                return new Promise((resolve,reject)=>{
                    reject('Please enter the correct cannel name!');
                })
            }
      }
      return new Promise((resolve,reject)=>{
          this.cli.publish(channel,message);
      })
   }

   onpub(channel,cb){
      if( !channel || typeof channel != "string" ){
        if(cb && typeof cb  === "function"){
            return cb('Please enter the correct cannel name!')
        }else{
            return new Promise((resolve,reject)=>{
                reject('Please enter the correct cannel name!');
            })
        }
      }
      return new Promise((resolve,reject)=>{
            this.cli.on("psubscribe",(channel, count)=>{
                ( cb && typeof cb  === "function" ) && cb(channel, count);
                resolve(channel, count);
            })
      })
   }

   message(channel,cb){
        if( !channel || typeof channel != "string" ){
            if(cb && typeof cb  === "function"){
                return cb('Please enter the correct cannel name!')
            }else{
                return new Promise((resolve,reject)=>{
                    reject('Please enter the correct cannel name!');
                })
            }
        }
        return new Promise((resolve,reject)=>{
            this.cli.on("message",(channel, message)=>{
                ( cb && typeof cb  === "function" ) && cb(channel, message);
                    resolve(channel, message);
            })
      })
   }

   quit (){
        this.cli.quit();
   }
}

module.exports.queue = queue;