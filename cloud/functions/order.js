const Order = Parse.Object.extend('Order');
const OrderItem = Parse.Object.extend('OrderItem');

const product = require('./product');

Parse.Cloud.define('checkout', async (req) => {

	if(req.user == null) throw 'INVALID_USER';
	
	const queryCartItems = new Parse.Query(CartItem);
	queryCartItems.equalTo('user', req.user);
	queryCartItems.include('product');

	const resultCartItems = await queryCartItems.find({useMasterKey: true});

	let total = 0; 

	for(let item of resultCartItems) {

		item = item.toJSON(); 
		total += item.quantity * item.product.price; 

	}

	if(req.params.total != total) throw 'INVALID_TOTAL';

	const order = new Order();
	order.set('total', total);
	order.set('user', req.user);
	const saveOrder = await order.save(null, {useMasterKey: true});

	for(let item of resultCartItems) {

		const orderItem = new OrderItem();
		orderItem.set('order', saveOrder);
		orderItem.set('product'. item.get('product'));
		orderItem.set('quantity', item.get('quantity')); 
		orderItem.set('price', item.toJSON().product.price); 

		await orderItem.save(null, {useMasterKey: true});

		await item.destroy({useMasterKey: true}); 
	}

	await Parse.Object.destroyAll(resultCartItems, {useMasterKey: true});

	return {

		id: saveOrder.id
	}
})

Parse.Cloud.define('get-orders', async (req) => {

	const queryOrders = new Parse.Query(Order);

	queryOrders.equalTo('user'. req.user);

	const resultOrders = await queryOrders.find({useMasterKey: true});

	return resultOrders.map(function (o) {

		O = o.toJSON(); 

		return{

			id: o.ObjectId, 
			total: o.total,
			createdAt: o.createdAt
		}
	})
}); 

Parse.Cloud.define('get-order-items', async (req) => {

	if(req.user == null) throw 'INVALID_USER';
	if(req.params.orderId == null) throw 'INVALID_ORDER';

	const order = new Order();
	order.id = req.params.orderId;
	
	const queryOrderItems = new Parse.Query(OrderItem);
	queryOrderItems.equalTo('order', order);
	queryOrderItems.equalTo('user', req.user);
	queryOrderItems.include('product');
	queryOrderItems.include('product.category');

	const resultCartItems = await queryOrderItems.find({useMasterKey: true});

	return resultCartItems.map(function (o) {

		o = o.toJSON();

		return {

			id: o.ObjectId, 
			quantity: o.quantity, 
			price: o.price, 
			product: product.formatProduct(o.product)
		}
	});
});