$(document).ready(function() {
    $('#staffTable').DataTable({
	"language" : {
	    "url" : "/public/locales/datatables_tr.json"
	},
	"lengthMenu" : [ [ 5, 10, 15 ], [ 5, 10, 15 ] ],
	"sPaginationType" : "full_numbers",
	"pageSize" : 5,
	"paging" : false,
	"scrollY" : "400px",
	"scrollCollapse" : true,
    });
});