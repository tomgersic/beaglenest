#BeagleNest

More information at [http://gersic.com/beaglebone-black-nest-thermostat-controller/](http://gersic.com/beaglebone-black-nest-thermostat-controller/)

My Nest thermostat is great, but it's in an irritating location in my house. It is in a room that tends to warm up quite a bit when the sun comes in the windows that take up most of one wall. It's also in the dining room within maybe three feet of the oven in my kitchen, and the light over my dining room table has 5 halogen bulbs that will also heat up the room considerably when turned on. All told, it tends to be a room that gets warmer than the rest of the house, which often results in the furnace not running, making the rest of the house colder than I want it.

This project takes a [Beaglebone Black](http://beagleboard.org/products/beaglebone%20black) with a [TMP36 Temperature Sensor](https://www.sparkfun.com/products/10988) to track the temperature in another room of my house, and turn up the thermostat when the temperature difference between rooms gets to be greater than 1° C (1.8° F). It will then turn it back down again when the temperature difference equalizes or the temperature in the second room gets warm enough.

The meat of this project is contained in beaglenest-client. The beaglenest-server script isn't neaded at all, except to provide a web-accessible log of operations. If you don't want that, you can just comment those bits out. It also uses Twilio to send me a text whenever it's overriding the existing Nest target temperature, and when it resets back to the default so that I know when it's being turned up. That can also be disabled if you just want the temperature sensing and Nest control.

This is all possible, in large part, due to the [Unofficial Nest API on Node](https://github.com/wiredprairie/unofficial_nodejs_nest). The makers of Nest are working on a public developer API, but it's not widely available right now, but this "unofficial" library makes good use of the existing APIs being used behind the scenes by the thermostat and existing Nest apps that are already out there.

##Logging Server

Like I mentioned, this bit isn't really needed, but I wanted a way to log override operations on the web and view those operations. The server side is a simple logging API based on Node.js Express. It'll log pretty much anything in JSON format and store it in MongoDB.

Example log GET request: http://[SOMEDOMAINHERE.COM]/log/{"somekey":"somevalue"}


Also contains a simple log viewing api at  http://[SOMEDOMAINHERE.COM]/view/[optional records limit]

This is intended for demo/POC purposes only. There's literally no security here, so you'll want to add some security measures if you're going to use this in a production environment.