# Javascript消息队列模块
安装：``npm install node-redis-queue-lh``
### 1、async异步模块

#####  1.1、eachLimit(coll, limit, iteratee, callback)

使用eachLimit限制JS并发任务数,coll为需要执行的队列,limit参数为并发执行的最大任务数，iteratee为执行的具体任务，iteratee函数拥有固定的参数：```item,index,cb```,```item```为当前需要执行的队列元素，```item```为队列的索引，```cb```为每个任务执行的回调函数，cb只有一个错误参数,若要继续执行下个任务，则传入的值为空，若传入的值不为空，则任务中断，执行```callback```回调函数。```callback```的参数是iteratee中传递的错误参数。

**demo：**

```js
let Async = require('node-redis-queue-lh').async;
let async = new Async();
async.eachLimit([1,4,2,3,5],2,function(item,index,callback){
  setTimeout(function(){
      console.log('index is ',index);
      callback();
  },item*1000);
},function(err){
    if(err){
        console.log('err is '+err);
    }else{
      console.log('done');
    }
});
```

以上代码的执行顺序如下:0、1、2、3、4而执行结果如下：

```js
index is  0
index is  2
index is  1
index is  3
index is  4
```

###  2、redis 消息队列

##### 2.1、初始化redis客户端、关闭客户端

```javascript
let queue = require('node-redis-queue-lh').queue;
let options = {db:3};
let client = new queue(options);

client.quit();//关闭客户端
```

**配置文件：**

``host``：redis的主机名称，默认：127.0.0.1

``port``：redis监听的端口号,默认：6379

``db``：选择的数据库编号,默认：0

``password``：进行redis权限验证的密码

``redis``：可传入已经初始化的客户端，非必需

##### 2.2、redis队列操作

###### 2.2.1、add(list, value,cb)

向队列中添加元素

``list``：所要插入的队列名称，若队列不存在，则创建队列

``value``：所要插入元素的值，值可以是字符串或数字，也可是数组

``cb``回调函数，非必需，参数为(error,count),也可使用promise语法来得到执行完成的结果

```
client.add('list0',[1,2,3]).then(function(count){
   console.log(count);
}).catch((err)=>{
  console.log(err);
})

```

###### 2.2.2、shift(list,timeout,cb)

开启子进程，从队列中获取一个元素，若队列为空，则阻塞连接，直到下一个```add```指令向队列中添加元素。

``list``：队列名称、数据类型是数组,如```[list0,list1,list2]```，该方法会调用redis的blpop方法，队列的优先级为list0>list1>list2。

``timeout``：阻塞的最大时长,当队列为空，引起客户端阻塞，若经过了指定延时时间还是没有向某个队列中插入元素，则客户端会解除指定的timeout状态并且返回null。

``cb``：回调函数，非必需，且回调支持promise语法参数为(error,result),若发生错误，则返回错误原因。通常情况下result为数组，格式为[list,value]，若队列为空并且设置timeout参数，则返回的值为null。

若不想使用

###### 2.2.3、shiftMany(list, limit,timeout,cb)

从队列中取出多个参数,具体的使用方式同上。

``limit``：每次从队列中取出的元素数量。

该方法是基于redis**MULTI / EXEC**流水线事务的，在事务被执行时，整个连接是被阻塞的，这就阻止了其他客户端执行push操作，因此，shiftMany方法会在list为空的时候返回一个null值，这和超时(timeout)的时候一摸一样。

**DEMO：**

```javascript
client.shiftMany(["list0","list1"],3,2).then(function(result){
   console.log(result);
}).catch(function(err){
  console.log(err);
})
```

#####  2.3、发布／订阅功能

###### 2.3.1、on(type,cb)

订阅状态的事件监听

``type``：需要的监听事件，目前该模块支持的事件类型有以下几种：```subscribe```、```psubscribe```、```unsubscribe```

如有需求，客户端还可支持频道名模糊匹配的``psubscribe``和``punsubscribe``的方法。

``cb``：回调函数，该参数为必需，因为Promise的resolve方法只可执行一次，所以改方法不支持promise语法。参数为(error,{channel:value,count:number})

###### 2.3.2、message(cb)

监听所有的psubscribe事件，具体使用方式同on,只是返回的参数为(error,{channel:value,message:value}),channel为发布的频道名，message为发布的消息详情。

###### 2.3.3、sub(channel,cb)

订阅频道

``channel``：需要订阅的频道。

``cb``：回调函数，主要用来返回参数验证错误的信息，因为JS异步的的原因，使用```on```方法监听subscribe事件。

###### 2.3.4、pub(channel,message,cb)

向指定频道发布消息

``channel``：发布消息的频道。

``message``：发布的消息内容。

``cb``：同``sub``,监听``psubscribe``事件，推荐使用``message``方法。

###### 2.3.5、unsub(channel,cb)

取消订阅

```channel```：这个值即可以是数组，也可以是字符串，若这个值为空，则取消该客户端所有的订阅。

以下是一个发布订阅的demo:

```javascript
let sub = new client({db:3});
let pub = new client({db:4})


sub.on('subscribe',function(err,result){
   if(err){
      console.log(err);
   }else{
      console.log('channel is ',result.channel);
      console.log('count is ',result.count);
   }
})

sub.message(function(err,result){
  if(err){
      console.log(err);
  }else{
      console.log('channel is ',result.channel);
      console.log('message is ',result.message);
  }
})

sub.sub('channel0').catch((err)=>{
   console.log('error is ',err);
})

sub.sub('channel1').catch((err)=>{
  console.log('error is ',err);
})


sub.sub('channel2').catch((err)=>{
  console.log('error is ',err);
})

sub.unsub(['channel1','channel2']).then(()=>{
  pub.pub("channel0","This is message");
  pub.pub("channel1","This is message");
}).catch((err)=>{
  console.log('error is ',err);
})
```

这段代码执行的结果：

```javascript
channel is  channel0
count is  1
channel is  channel1
count is  2
channel is  channel2
count is  3
channel is  channel0
message is  This is message
```

### 3、EXAMPLE

##### 3.1、文件传输

本例子使用了队列任务中的``add``和``shift``方法，文件目录为``./example/changeFile``,newfile下old目录为要监听的文件夹，new目录为目标文件夹，若在old文件夹中添加文件，传入任务就会添加到任务队列中，核心代码为``transmitFile``方法。运行方式:

```
node ./example/changeFile/file.js
```





