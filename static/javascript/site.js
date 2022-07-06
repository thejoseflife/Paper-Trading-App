var Site = function() {
	this.symbol = "GME";
};

Site.prototype.Init = function() {
	this.LoadQuote();
	this.CalculatePortfolioValue();
	this.LoadPositions();
	$("#symbol").on("click", function() {
		$(this).val("");
	});
};

Site.prototype.LoadQuote = function() {
	var that = this;
	$.ajax({
		url: "/quote?symbol=" + that.symbol,
		method: "GET",
		cache: false
	}).done(function(data) {
		var context = {};
		context.shortName = data.shortName;
		context.symbol = data.symbol;
		context.price = data.ask;

		if(data.quoteType = "MUTUALFUND") {
			context.price = data.previousClose;
		}

		that.LoadChart(context);
	});
};

Site.prototype.LoadPositions = function() {
	var that = this;
	$.ajax({
		url: "/loadpositions",
		method: "GET",
		cache: false
	}).done(function(data) {
		let message = "Cash: ";
		let positions = [];

		// Make sure cash is the first value drawn
		for (var i = 0; i < data.length; i++) {
			if (data[i][0] == "CASH") {
				var formatter = new Intl.NumberFormat('en-US', {
					style: 'currency',
					currency: 'USD',
				});
				let formattedValue = formatter.format(data[i][1]);
				message += String(formattedValue);
			} else {
				positions.push(data[i]);
			}
		}

		for (var i = 0; i < positions.length; i++) {
			let shareMessage = "share";
			if (parseFloat(positions[i][1]) != 1) {
				shareMessage += "s";
			}
			message += ", " + String(positions[i][1]) + " " + shareMessage + " of " + String(positions[i][0]);
			let priceData = parseFloat(positions[i][1] * parseFloat(positions[i][2]));
			let value = Math.round(priceData * 100) / 100;
			var formatter = new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: 'USD',
			});
			let formattedValue = formatter.format(value);
			message += " valued at " + String(formattedValue);
		}
		document.getElementById("positions").innerHTML = message;
		
	});
}


Site.prototype.Reset = function() {
	var that = this;

	// Set a 0.5 second timeout to allow database to settle
	document.getElementById("reset-button").disabled = true;
	setTimeout(function(){document.getElementById("reset-button").disabled = false;}, 500);

	$.ajax({
		url: "/reset",
		method: "GET",
		cache: false
	}).done(function(data) {
		that.DisplayNotification("Reset Portfolio.");
		that.CalculatePortfolioValue();
		that.LoadPositions();
	});
}

Site.prototype.ReloadChart = function() {
	// Set a 0.5 second timeout to allow database to settle
	document.getElementById("refresh-button").disabled = true;
	setTimeout(function(){document.getElementById("refresh-button").disabled = false;}, 500);

	this.LoadQuote();
	this.CalculatePortfolioValue();
	this.LoadPositions();
	that.DisplayNotification("Refreshed Chart.");
}

Site.prototype.SubmitTicker = function() {
	// Set a 0.5 second timeout to allow database to settle
	document.getElementById("submit-button").disabled = true;
	setTimeout(function(){document.getElementById("submit-button").disabled = false;}, 500);

	this.symbol = String($("#symbol").val()).toUpperCase();
	this.LoadQuote();
	this.DisplayNotification("Getting Data for " + this.symbol + ".");
}

Site.prototype.CalculatePortfolioValue = function() {
	var that = this;
	$.ajax({
		url: "/portfolio",
		method: "GET",
		cache: false
	}).done(function(data) {
		var formatter = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		});
		let portfolioValue = formatter.format(parseFloat(data));
		// console.log("data: " + data);
		document.getElementById("header").innerHTML = "Portfolio Value: " + portfolioValue;
	});
}

Site.prototype.DisplayNotification = function(message) {
	document.getElementById("notification").innerHTML = message;
}

Site.prototype.BuyStock = function() {
	this.symbol = String($("#symbol").val()).toUpperCase();
	var that = this;

	// Set a 0.5 second timeout to allow database to settle
	document.getElementById("buy-button").disabled = true;
    setTimeout(function(){document.getElementById("buy-button").disabled = false;}, 500);

	$.ajax({
		url: "/buy?symbol=" + that.symbol,
		method: "GET",
		cache: false
	}).done(function(data) {
		// console.log(data)
		if (data == "1") {
			let message = "Purchased one share of " + that.symbol + ".";
			that.DisplayNotification(message);
		} else if (data == "0") {
			let message = "Not enough cash to purchase " + that.symbol + ".";
			that.DisplayNotification(message);
		}
		that.LoadPositions();
	});
}

Site.prototype.SellStock = function() {
	this.symbol = String($("#symbol").val()).toUpperCase();
	var that = this;

	// Set a 0.5 second timeout to allow database to settle
	document.getElementById("sell-button").disabled = true;
	setTimeout(function(){document.getElementById("sell-button").disabled = false;}, 500);

	$.ajax({
		url: "/sell?symbol=" + that.symbol,
		method: "GET",
		cache: false
	}).done(function(data) {
		if (data == "1") {
			let message = "Sold one share of " + that.symbol + ".";
			that.DisplayNotification(message);
		} else if (data == "0") {
			let message = "No shares of " + that.symbol + " to sell.";
			that.DisplayNotification(message);
		}
		that.LoadPositions();
	});
}

Site.prototype.LoadChart = function(quote) {

	var that = this;
	$.ajax({
		url: "/history?symbol=" + that.symbol,
		method: "GET",
		cache: false
	}).done(function(data) {
		that.RenderChart(JSON.parse(data), quote);
	});
};

Site.prototype.RenderChart = function(data, quote) {
	var priceData = [];
	var dates = [];

	for(var i in data.Close) {
		var dt = i.slice(0, i.length - 3);
		var dateString = moment.unix(dt).format("h:mm A");
		var close = data.Close[i];
		if(close != null) { 
			priceData.push(data.Close[i]);
			dates.push(dateString);
		}
	}

	var priceDataTrimmed = [];
	for (var i = 0; i < priceData.length; i++) {
		priceDataTrimmed.push(Math.round(priceData[i] * 100) / 100);
	}

	let closingPrice = 0;
	if (priceDataTrimmed.length > 0) {
		closingPrice = priceDataTrimmed[priceDataTrimmed.length - 1];
	}
	var title = quote.shortName  + " (" + quote.symbol + ") - " + String(closingPrice);

	let maxPrice = Math.ceil(Math.max.apply(Math, priceData));
	let minPrice = Math.floor(Math.min.apply(Math, priceData));

	let colorInput = '#09ff00';

	if (priceData.length > 0) {
		let firstPrice = priceData[0];
		let lastPrice = priceData[priceData.length - 1];
	
		if (firstPrice > lastPrice) {
			colorInput = '#ff0000';
		}
	}

	var dateTitle = moment.unix(dt).format("MM/DD/YYYY");

	/* var datesTrimmed = [];
	for (var i = 0; i < dates.length; i++) {
		let dateString1 = String(dates[i]);
		if (dateString1.length > 4) {
			let dateSubstring1 = dateString1.substring(dateString1.length - 5, dateString1.length - 3);
			if (!isNaN(dateSubstring1)) {
				let dateInt1 = parseInt(dateSubstring1);
				if (dateInt1 % 5 == 0 || dateInt1 % 10 == 0)
				datesTrimmed.push(dates[i]);
			}
			
		}
		
	} */
	
	/* var datesOnInterval = ["9:30 AM", "9:35 AM", "9:40 AM", "9:45 AM", "9:50 AM", "9:55 AM", "10:00 AM", "10:05 AM", "10:10 AM", "10:15 AM", "10:20 AM", "10:25 AM", "10:30 AM", "10:35 AM", "10:40 AM", "10:45 AM", "10:50 AM", "10:55 AM", "11:00 AM", "11:05 AM", "11:10 AM", "11:15 AM", "11:20 AM", "11:25 AM", "11:30 AM", "11:35 AM", "11:40 AM", "11:45 AM", "11:50 AM", "11:55 AM", "12:00 PM", "12:05 PM", "12:10 PM", "12:15 PM", "12:20 PM", "12:25 PM", "12:30 PM", "12:35 PM", "12:40 PM", "12:45 PM", "12:50 PM", "12:55 PM", "1:00 PM", "1:05 PM", "1:10 PM", "1:15 PM", "1:20 PM", "1:25 PM", "1:30 PM", "1:35 PM", "1:40 PM", "1:45 PM", "1:50 PM", "1:55 PM", "2:00 PM", "2:05 PM", "2:10 PM", "2:15 PM", "2:20 PM", "2:25 PM", "2:30 PM", "2:35 PM", "2:40 PM", "2:45 PM", "2:50 PM", "2:55 PM", "3:00 PM", "3:05 PM", "3:10 PM", "3:15 PM", "3:20 PM", "3:25 PM", "3:30 PM", "3:35 PM", "3:40 PM", "3:45 PM", "3:50 PM", "3:55 PM", "4:00 PM"]; */

	Highcharts.chart('chart_container', {
		chart: {
			width: 1200
		},
		title: {
			text: title
		},
		yAxis: {
			floor: minPrice,
			ceiling: maxPrice,
			title: {
				text: ''
			}
		},
		xAxis: {
            step:1,  
            tickInterval: Math.ceil(dates.length / 10),
            labels: {
                rotation: 0,
                style: {
                    fontSize:'15px'
                }
            },
			categories: dates,
			showLastLabel: true,
			endOnTick: false
		},
		series: [{
			// type: 'line',
			color: colorInput,
			name: `${dateTitle} Price`,
			data: priceDataTrimmed
		}],

	});

};

var site = new Site();

$(document).ready(()=>{
	site.Init();
})
