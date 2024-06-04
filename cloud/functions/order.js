var Gerencianet = require('gn-api-sdk-node');

const Order = Parse.Object.extend('Order');
const OrderItem = Parse.Object.extend('OrderItem');
const CartItem = Parse.Object.extend('CartItem');

const product = require('./product');

var options = {

	sandbox: true, 
	client_id: 'Client_Id_2426a82e1a99358a3c292b8b26ef848e1267cdac',
	client_secret: 'Client_Secret_49f729f831b93a031083a7dd509051b66a894eba',
	pix_cert: __dirname + '/homologacao-573702-mercadinho.p12',
}

var gerencianet = new Gerencianet(options);

Date.prototype.addSeconds = function(s) {

	this.setTime(this.getTime() + (s * 1000));
	return this;
}

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

	const dueSeconds = 3600;
	const due = new Date().addSeconds(dueSeconds);

	const charge = await createCharge(dueSeconds, req.user.get('cpf'), req.user.get('fullname'), total);
	const qrCodeData = await generateQRCode(charge.loc.id);

	const order = new Order();
	order.set('total', total);
	order.set('user', req.user);
	order.set('dueDate', due);
	order.set('qrCodeImage', qrCodeData.imagemQrcode);
	order.set('qrcode', qrCodeData.qrcode);
	order.set('txid', charge.txid);
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

		id: saveOrder.id,
		total: total, 
		qrCodeImage: qrCodeData.imagemQrcode, 
		copiecola: qrCodeData.qrcode, 
		due: due.toISOString(),
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
			createdAt: o.createdAt,
			due: o.dueDate.iso, 
			qrCodeImage: o.qrCodeImage, 
			copiecola: o.qrCode
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

Parse.Cloud.define('webhook', async (req) => {

	if(req.user == null) throw 'INVALID_USER';
	if(req.user.id != 'YE69MJZxDK') throw 'INVALID_USER';
	return 'Olaá Mundo !';
})

async function createCharge(dueSeconds, cpf, fullname) {

	let body = {
		calendario: {
			expiracao: dueSeconds,
		},
		devedor: {
			cpf: cpf.replace(/\D/g, ''),
			nome: fullname,
		},
		valor: {
			original: price.toFixed(2),
		},
		chave: 'ghdss_ti@hotmail.com', // Informe sua chave Pix cadastrada na gerencianet	
		
	}
	
	//const gerencianet = new Gerencianet(options)
	
	const response = await gerencianet.pixCreateImmediateCharge([], body);
	return response;
}

async function generateQRCode() {

	let params = {
		id: locId
	}
	
	const response = await gerencianet.pixGenerateQRCode(params);
	return response;
}