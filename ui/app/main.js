var cinp;

var base_path;

var cur_path;
var cur_action;
var field_map;
var parameter_map;
var current_filter;
var filter_parameter_map;

$( document ).ready( function()
{
  $( '#ns-tree' ).treed( );

  $( window ).on( 'hashchange', handleHashChange );
  handleHashChange();

  $( '#connect-btn' ).on( 'click', connect );
  $( '#list-btn' ).on( 'click', list );
  $( '#get-btn' ).on( 'click', get );
  $( '#create-clear-btn' ).on( 'click', create_clear );
  $( '#create-btn' ).on( 'click', create );
  $( '#update-get-btn' ).on( 'click', update_get );
  $( '#update-btn' ).on( 'click', update );
  $( '#delete-btn' ).on( 'click', delete_obj );
  $( '#call-btn' ).on( 'click', call );
  $( '#auth-id-text' ).on( 'blur', set_auth );
  $( '#auth-token-text' ).on( 'blur', set_auth );

  for( var key of [ 'describe', 'list', 'get', 'create', 'update', 'delete', 'call' ] )
  {
    $( '#' + key + '-label' ).on( 'click', showtab );
  }
  $( '#describe-label' ).click();
} );

function connect( event )
{
  var api_location = $( '#api-location-text' ).val();
  if( api_location === "" )
  {
    api_location = $( '#api-location-text' ).attr( 'placeholder' );
  }

  base_path = api_location.substr( api_location.indexOf( '/', 10 ) );

  cinp = cinpBuilder( api_location.substr( 0, api_location.indexOf( '/', 10 ) ) );
  cinp.server_error_handler = serverError;

  var tree = $( '#ns-tree' );

  tree.empty();

  cinp.describe( base_path )
    .done( function( data ){ _loadTree( data, tree ); } )
    .fail( _describe_fail );

  setElement( base_path );
}

function _describe_fail( message, detail )
{
  // yes, this is diferent, there is not global XXXXX-alert for describe
  // when there is this can change, can't user ServerError b/c the cinp handler
  // could use it, and if it does, calling ServerError here would cover that up
  if( detail === undefined )
  {
    alert( message );
  }
  else
  {
    alert( message + ": " + detail );
  }
}

function set_auth( event )
{
  cinp.setAuth( $( '#auth-id-text' ).val(), $( '#auth-token-text' ).val() );
}

function _loadTree( element, tree )
{
  if( element.type.toLowerCase() == 'namespace' )
  {
    var subtree = $( '<ul />' );

    var entry = $( '<li />' );
    var label = $( '<span>' + element.name + '</span>' );
    label.on( 'click', function( event ){ setElement( element.path ) } );
    entry.append( label );
    entry.append( subtree );
    tree.append( entry );

    for( var namespace of element.namespace_list )
    {
      cinp.describe( namespace )
        .done( function( data ){ _loadTree( data, subtree ); } )
        .fail( _describe_fail );
    }
    for( var model of element.model_list )
    {
      cinp.describe( model )
        .done( function( data ){ _loadTree( data, subtree ); } )
        .fail( _describe_fail );
    }
  }
  else if ( element.type.toLowerCase() == 'model' )
  {
    var entry = $( '<li />' );
    var label = $( '<span>' + element.name + '</span>' );
    label.on( 'click', function( event ){ setElement( element.path ) } );
    entry.append( label );
    tree.append( entry );
  }
}

function setElement( path )
{
  cur_path = path;
  field_map = {};
  action_list = [];
  cur_action = null;
  parameter_map = {};
  current_filter = '* ALL *';
  filter_parameter_map = {};

  $( '#path' ).html( path );

  $( '#describe-values-table tbody' ).empty();
  $( '#describe-fields-table tbody' ).empty();
  $( '#list-table tbody' ).empty();
  $( '#get-values-table tbody' ).empty();
  $( '#create-values-table tbody' ).empty();
  $( '#create-id' ).empty();
  $( '#update-values-table tbody' ).empty();
  $( '#get-id-text' ).val( '' );
  $( '#update-id-text' ).val( '' );
  $( '#delete-id-text' ).val( '' );
  $( '#action-dropdown' ).empty();
  $( '#filter-dropdown' ).empty();
  $( '#call-parameter-table tbody' ).empty();
  $( '#list-parameter-table tbody' ).empty();
  $( '#list-alert' ).empty();
  $( '#list-parameter-row' ).hide();
  $( '#get-alert' ).empty();
  $( '#create-alert' ).empty();
  $( '#update-alert' ).empty();
  $( '#delete-alert' ).empty();
  $( '#call-alert' ).empty();
  $( '#call-doc' ).empty();
  $( '#call-id-group' ).hide();
  $( '#call-id-text' ).val( '' );

  cinp.describe( cur_path )
    .done( _describe_done )
    .fail( _describe_fail );
}

function _edit_func( parameter, target )
{
  if( parameter.is_array )
  {
    listEdit( target, parameter.default );
  }
  else if( parameter.type == 'String' )
  {
    if( parameter.length === null )
    {
      textAreaEdit( target, parameter.default );
    }
    else
    {
      textEdit( target, parameter.default, parameter.length );
    }
  }
  else if( parameter.type ==  'Boolean' )
  {
    booleanEdit( target, parameter.default );
  }
  else if( parameter.type == 'Map' )
  {
    mapEdit( target, parameter.default );
  }
  else
  {
    textEdit( target, parameter.default, 25 );
  }
}

function _view_func( parameter, target )
{
  if( parameter.type ==  'Boolean' )
  {
    booleanView( target );
  }
  else if( parameter.type == 'Map' )
  {
    mapView( target );
  }
  else
  {
    textView( target );
  }
}

function _describe_done( data )
{
  var values = $( '#describe-values-table tbody' );
  var fields = $( '#describe-fields-table tbody' );
  var get_table = $( '#get-values-table tbody' );
  var create_table = $( '#create-values-table tbody' );
  var update_table = $( '#update-values-table tbody' );

  for( var key in data )
  {
    if( key == 'field_list' )
    {
      continue;
    }
    else if( key == 'list_filter_list' )
    {
      values.append( '<tr><td>' + key + '</td><td>' + Object.keys( data[ key ] ) + '</td></tr>' );
    }
    else if( ( key == 'constant_list' ) || ( key == 'query_filter_field_list' ) )
    {
      values.append( '<tr><td>' + key + '</td><td>' + JSON.stringify( data[ key ] ) + '</td></tr>' );
    }
    else
    {
      values.append( '<tr><td>' + key + '</td><td>' + data[ key ] + '</td></tr>' );
    }
  }

  if( data.type == 'model' )
  {
    fields.parent().parent().show();

    for( var action of data.action_list )
    {
      var entry = $( '<li>' + action + '</li>' );
      entry.on( 'click', load_action );
      $( '#action-dropdown' ).append( entry );
    }

    var entry = $( '<li>* ALL *</li>' );
    entry.on( 'click', load_filter );
    $( '#filter-dropdown' ).append( entry );

    if( data.query_filter_field_list.length > 0 )
    {
      var entry = $( '<li>* QUERY *</li>' );
      entry.on( 'click', load_filter );
      $( '#filter-dropdown' ).append( entry );
    }

    for( var filter_name in data.list_filter_list )
    {
      var entry = $( '<li>' + filter_name + '</li>' );
      entry.on( 'click', load_filter );
      $( '#filter-dropdown' ).append( entry );

      filter_parameter_map[ filter_name ] = {};
      for( var parameter of data.list_filter_list[ filter_name ] )
      {
        var doc = parameter.doc;

        filter_parameter_map[ filter_name ][ parameter.name ] = parameter;
      }
    }

    for( var tab of [ 'list', 'get', 'create', 'update', 'delete', 'call' ] )
    {
      $( '#' + tab + '-label' ).parent().removeClass( 'disabled' );
    }

    for( var field of data.field_list )
    {
      var attribs = [];
      if( field.required )
      {
        attribs.push( 'required' );
      }
      if( field.is_array )
      {
        attribs.push( 'array' );
      }
      if( field.length !== undefined && field.length != null )
      {
        attribs.push( 'length: ' + field.length );
      }
      if( field.uri !== undefined )
      {
        attribs.push( 'uri: ' + field.uri );
      }
      if( field.choices !== undefined )
      {
        attribs.push( 'choices: ' + field.choices );
      }

      var default_value = field.default;
      if( default_value === undefined )
      {
        default_value = '';
      }
      else
      {
        default_value = JSON.stringify( default_value );
      }
      var doc = field.doc;
      if( doc === undefined )
      {
        doc = '';
      }

      fields.append( '<tr><td>' + field.name  + '</td><td>' + field.type + '</td><td>' + field.mode + '</td><td>' + default_value + '</td><td>' + attribs + '</td><td>' + doc + '</td></tr>' );

      get_table.append( '<tr><th id="get-' + field.name + '-label">' + field.name + '</th><td><span id="get-' + field.name + '"/></td></tr>' );
      create_table.append( '<tr><th id="create-' + field.name + '-label">' + field.name + '</th><td><span id="create-' + field.name + '"/></td></tr>' );
      update_table.append( '<tr><th id="update-' + field.name + '-label">' + field.name + '</th><td><span id="update-' + field.name + '"/></td></tr>' );

      if( field.mode == 'RC' )
      {
        _view_func( field, $( '#get-' + field.name ) );
        _edit_func( field, $( '#create-' + field.name ) );
        _view_func( field, $( '#update-' + field.name ) );
      }
      else if( field.mode == 'RW' )
      {
        _view_func( field, $( '#get-' + field.name ) );
        _edit_func( field, $( '#create-' + field.name ) );
        _edit_func( field, $( '#update-' + field.name ) );
      }
      else
      {
        _view_func( field, $( '#get-' + field.name ) );
        _view_func( field, $( '#create-' + field.name ) );
        _view_func( field, $( '#update-' + field.name ) );
      }

      $( '#get-' + field.name ).trigger( 'clear' );
      $( '#create-' + field.name ).trigger( 'clear' );
      $( '#update-' + field.name ).trigger( 'clear' );

      field_map[ field.name ] = field;
    }
  }
  else
  {
    fields.parent().parent().hide();
    for( var tab of [ 'list', 'get', 'create', 'update', 'delete', 'call' ] )
    {
      $( '#' + tab + '-label' ).parent().addClass( 'disabled' );
    }
  }
}

function list( event )
{
  $( '#list-table tbody' ).empty();
  $( '#list-alert' ).empty();

  var filter_name = current_filter;
  var filter_values = undefined;
  if( filter_name == '* ALL *' )
  {
    filter_name = undefined;
    filter_values = undefined;
  }
  else if( filter_name == '* QUERY *' )
  {
    filter_name = '_query_';
    filter_values = {};
    filter_values[ 'filter' ] = $( '#filter-parameter-filter' ).data( 'get' )( $( '#filter-parameter-filter' ) );
  }
  else
  {
    filter_values = {};
    for( var parameter in filter_parameter_map[ current_filter ] )
    {
      filter_values[ parameter ] = $( '#filter-parameter-' + parameter ).data( 'get' )( $( '#filter-parameter-' + parameter ) );
      $( '#filter-parameter-' + parameter +'-label' ).removeClass( 'alert-danger' );
      $( '#filter-parameter-' + parameter ).trigger( 'error_clear' );
    }
  }

  cinp.list( cur_path, filter_name, filter_values, $( '#list-position-text' ).val(), $( '#list-count-text' ).val() )
    .done( _list_done )
    .fail( _list_fail );
}

function _list_done( id_list, position, count, total )
{
  $( '#list-alert' ).html( 'Loaded "' + count + '" objects, starting at "' + position + '" of "' + total + '"' );
  var table = $( '#list-table tbody' );

  for( var id of id_list )
  {
    table.append( '<tr><td>' + id + '</td></tr>' );
  }
}

function _list_fail( message, detail )
{
  if( detail === undefined )
  {
    $( '#list-alert' ).html( 'Error: "' + message + '"' );
  }
  else
  {
    if( typeof( detail ) == 'object' )
    {
      $( '#list-alert' ).append( 'Fix Errors Below' );
      for( var parameter in detail )
      {
        $( '#filter-parameter-' + parameter +'-label' ).addClass( 'alert-danger' );
        $( '#filter-parameter-' + parameter ).trigger( 'error', [ detail[ parameter ] ] );
      }
    }
    else
    {
      $( '#list-alert' ).html( 'Error: "' + message + '": "' + detail + '"' );
    }
  }

}

function get( event )
{
  $( '#get-alert' ).empty();
  for( var field in field_map )
  {
    $( '#get-' + field ).trigger( 'clear' );
  }

  cinp.get( cur_path + ':' + $( '#get-id-text' ).val() + ':', false )
    .done( _get_done )
    .fail( _get_fail );
}

function _get_done( values )
{
  $( '#get-alert' ).html( 'Object Id "' + $( '#get-id-text' ).val() + '" Reterieved.' );
  for( var field in field_map )
  {
    $( '#get-' + field ).trigger( 'set', [ values[ field ] ] );
  }
}

function _get_fail( message, detail )
{
  if( detail === undefined )
  {
    $( '#get-alert' ).html( 'Error: "' + message + '"' );
  }
  else
  {
    $( '#get-alert' ).html( 'Error: "' + message + '": "' + detail + '"' );
  }
}

function create_clear( event )
{
  $( '#create-alert' ).empty();
  $( '#create-id' ).empty();

  for( var field in field_map )
  {
    $( '#create-' + field ).trigger( 'clear' );
    $( '#create-' + field + '-label' ).removeClass( 'alert-danger' );
  }
}

function create( event )
{
  $( '#create-alert' ).empty();
  $( '#create-id' ).empty();

  var values = {}
  for( var field in field_map )
  {
    var value;
    if( field_map[ field ].mode == 'RW' || field_map[ field ].mode == 'RC' )
    {
      value = $( '#create-' + field ).data( 'get' )( $( '#create-' + field ) );
      if( field_map[ field ].required || value )
      {
        values[ field ] = value;
      }
    }
    $( '#create-' + field + '-label' ).removeClass( 'alert-danger' );
    $( '#create-' + field ).trigger( 'error_clear' );
  }

  cinp.create( cur_path, values )
    .done( _create_done )
    .fail( _create_fail );
}

function _create_done( values, id )
{
  $( '#create-alert' ).html( 'Object Id "' + id + '" Created.' );
  $( '#create-id' ).html( id );

  for( var field in field_map )
  {
    $( '#create-' + field ).trigger( 'set', [ values[ field ] ] );
  }
}

function _create_fail( message, detail )
{
  if( detail === undefined )
  {
    $( '#create-alert' ).html( 'Error: "' + message + '"' );
  }
  else
  {
    if( typeof( detail ) == 'object' )
    {
      $( '#create-alert' ).html( 'Fix Errors Below' );
      for( var field in detail )
      {
        $( '#create-' + field + '-label' ).addClass( 'alert-danger' );
        $( '#create-' + field ).trigger( 'error', [ detail[ field ] ] );
      }
    }
    else
    {
      $( '#create-alert' ).html( 'Error: "' + message + '": "' + detail + '"' );
    }
  }
}

function update_get( event )
{
  $( '#update-alert' ).empty()
  for( var field in field_map )
  {
    $( '#update-' + field +'-label' ).removeClass( 'alert-danger' );
    $( '#update-' + field ).trigger( 'clear' );
  }

  cinp.get( cur_path + ':' + $( '#update-id-text' ).val() + ':', false )
    .done( _update_get_done )
    .fail( _update_fail );
}

function _update_get_done( values )
{
  $( '#update-alert' ).html( 'Object Id "' + $( '#update-id-text' ).val() + '" Reterieved.' );

  _update_load( values );
}

function update( event )
{
  $( '#update-alert' ).empty()

  var values = {}
  for( var field in field_map )
  {
    var value;
    if( field_map[ field ].mode == 'RW' )
    {
      value = $( '#update-' + field ).data( 'get' )( $( '#update-' + field ) );
      if( field_map[ field ].required || value )
      {
        values[ field ] = value;
      }
    }
    $( '#update-' + field + '-label' ).removeClass( 'alert-danger' );
    $( '#update-' + field ).trigger( 'error_clear' );
  }

  cinp.update( cur_path + ':' + $( '#update-id-text' ).val() + ':', values, false )
    .done( _update_done )
    .fail( _update_fail );
}

function _update_done( values )
{
  $( '#update-alert' ).html( 'Object Id "' + $( '#update-id-text' ).val() + '" Updated.' );

  _update_load( values );
}

function _update_fail( message, detail )
{
  if( detail === undefined )
  {
    $( '#update-alert' ).append( 'Error: "' + message + '"' );
  }
  else
  {
    if( typeof( detail ) == 'object' )
    {
      $( '#update-alert' ).append( 'Fix Errors Below' );
      for( var field in detail )
      {
        $( '#update-' + field +'-label' ).addClass( 'alert-danger' );
        $( '#update-' + field ).trigger( 'error', [ detail[ field ] ] );
      }
    }
    else
    {
      $( '#update-alert' ).html( 'Error: "' + message + '": "' + detail + '"' );
    }
  }
}

function _update_load( values )
{
  for( var field in field_map )
  {
    $( '#update-' + field ).trigger( 'set', [ values[ field ] ] );
  }
}

function delete_obj( event )
{
  $( '#delete-alert' ).empty();

  cinp.delete( cur_path + ':' + $( '#delete-id-text' ).val() + ':' )
    .done( _delete_done )
    .fail( _delete_fail );
}

function _delete_done()
{
  $( '#delete-alert' ).html( 'Object Id "' + $( '#delete-id-text' ).val() + '" deleted.' );
}

function _delete_fail( message, detail )
{
  if( detail === undefined )
  {
    $( '#delete-alert' ).html( 'Error: "' + message + '"' );
  }
  else
  {
    $( '#delete-alert' ).html( 'Error: "' + message + '": "' + detail + '"' );
  }
}

function load_filter( event )
{
  $( '#list-alert' ).empty();

  var parameter_table = $( '#list-parameter-table tbody' );
  parameter_table.empty();

  current_filter = this.childNodes[0].textContent;

  if( current_filter == '* ALL *' )
  {
    $( '#list-parameter-row' ).hide();
    return;
  }

  $( '#list-parameter-row' ).show();

  if( current_filter == '* QUERY *' )
  {
    var row = $( '<tr><th id="filter-parameter-filter-label">Filter</th><td><span id="filter-parameter-filter"/></td></tr>' );
    _edit_func( { 'type': 'Map' }, row.find( '#filter-parameter-filter' ) )
    parameter_table.append( row );
    $( '#filter-parameter-filter' ).trigger( 'clear' );
    return;
  }

  for( var name in filter_parameter_map[ current_filter ] )
  {
    var parameter = filter_parameter_map[ current_filter ][ name ];
    var doc = parameter.doc;
    if( doc === undefined )
    {
      doc = '';
    }

    var row = $( '<tr><th id="filter-parameter-' + parameter.name + '-label">' + parameter.name + '</th><td><span id="filter-parameter-' + parameter.name + '"/></td><td>' + doc + '</td></tr>' );
    _edit_func( parameter, row.find( '#filter-parameter-' + parameter.name ) )
    parameter_table.append( row );
    $( '#filter-parameter-' + parameter.name ).trigger( 'clear' );
  }
}

function load_action( event )
{
  $( '#call-alert' ).empty();
  $( '#call-doc' ).empty();
  $( '#call-id-group' ).hide();
  $( '#call-id-text' ).val( '' );

  parameter_map = {};
  $( '#call-parameter-table tbody' ).empty();

  cur_action = this.childNodes[0].textContent;

  cinp.describe( cur_action )
    .done( _call_describe_done )
    .fail( _call_fail );
}

function _call_describe_done( data )
{
  var parameter_table = $( '#call-parameter-table tbody' );

  for( var parameter of data.parameters )
  {
    var doc = parameter.doc;
    if( doc === undefined )
    {
      doc = '';
    }

    var row = $( '<tr><th id="parameter-' + parameter.name + '-label">' + parameter.name + '</th><td><span id="parameter-' + parameter.name + '"/></td><td>' + doc + '</td></tr>' );
    _edit_func( parameter, row.find( '#parameter-' + parameter.name ) )
    parameter_table.append( row );
    parameter_map[ parameter.name ] = parameter;
    $( '#parameter-' + parameter.name ).trigger( 'clear' );
  }

  if( !data.static )
  {
    $( '#call-id-group' ).show();
  }

  if( data.doc )
  {
    $( '#call-doc' ).html( data.doc );
    $( '#call-doc' ).show();
  }
  else
  {
    $( '#call-doc' ).hide();
  }
  $( '#call-alert' ).html( 'Action: "' + cur_action + '" loaded' );
}

function call( event )
{
  $( '#call-alert' ).empty()

  var uri = cur_action;
  if( $( '#call-id-group' ).is( ':visible' ) )
  {
    uri = uri.split( '(' )[0] + ':' + $( '#call-id-text' ).val() + ':(' + uri.split( '(' )[1]
  }

  var values = {};
  for( var parameter in parameter_map )
  {
    values[ parameter ] = $( '#parameter-' + parameter ).data( 'get' )( $( '#parameter-' + parameter ) );
    $( '#parameter-' + parameter +'-label' ).removeClass( 'alert-danger' );
    $( '#parameter-' + parameter ).trigger( 'error_clear' );
  }

  cinp.call( uri, values, false )
    .done( _call_done )
    .fail( _call_fail );
}

function _call_done( result )
{
  if( typeof result === 'object' )
  {
    result = JSON.stringify( result, null, 2 );
  }

  $( '#call-alert' ).html( 'result: "' + result + '"' );
  for( var parameter in parameter_map )
  {
    $( '#parameter-' + parameter ).trigger( 'clear' );
  }
}

function _call_fail( message, detail )
{
  if( detail === undefined )
  {
    $( '#call-alert' ).html( 'Error: "' + message + '"' );
  }
  else
  {
    if( typeof( detail ) == 'object' )
    {
      $( '#call-alert' ).append( 'Fix Errors Below' );
      for( var parameter in detail )
      {
        $( '#parameter-' + parameter +'-label' ).addClass( 'alert-danger' );
        $( '#parameter-' + parameter ).trigger( 'error', [ detail[ parameter ] ] );
      }
    }
    else
    {
      $( '#call-alert' ).html( 'Error: "' + message + '": "' + detail + '"' );
    }
  }
}

function serverError( message, detail )
{
  $( '#server-error-dialog .modal-body' ).html( message );
  if( detail !== undefined )
  {
    $( '#server-error-dialog .modal-detail' ).html( '<pre>' + detail + '</pre>' );
  }
  else
  {
    $( '#server-error-dialog .modal-detail' ).empty();
  }
  $( '#server-error-dialog' ).modal( 'show' );
}

function showtab( event )
{
  for( var tab of [ 'describe', 'list', 'get', 'create', 'update', 'delete', 'call' ] )
  {
    $( '#' + tab + '-panel' ).hide();
    $( '#' + tab + '-label' ).parent().removeClass( 'active' );
  }

  var name =  this.id.split( '-' )[0];
  $( '#' + name + '-panel' ).show();
  $( '#' + name + '-label' ).parent().addClass( 'active' );
}

function handleHashChange( event )
{
  const panel_list = [ 'settings', 'about' ];
  var panel;

  $( '#main-panel' ).hide();
  for( panel of panel_list )
  {
    $( '#' + panel + '-label' ).removeClass( 'active' );
    $( '#' + panel + '-panel' ).hide();
  }

  panel = location.hash;
  if( panel !== '' )
  {
    panel = panel.substr( 1 );
  }

  if( panel === '' )
  {
    $( '#main-panel' ).show();
  }
  else
  {
    $( '#' + panel + '-label' ).addClass( 'active' );
    $( '#' + panel + '-panel' ).show();
  }
}

function textView( target )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<span id="' + id +  '"/>' );
  var msg = $( '<span class="alert alert-info"/>' );

  target.data( 'msg', msg );
  target.on( 'clear', function() { $( this ).empty(); $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );
  target.on( 'set', function( event, value ) { $( this ).html( value ); return false; } );
  target.data( 'get', function( field ) { return $( field ).html(); return false; } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function textEdit( target, default_value, length )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  if( length === undefined )
  {
    length = 30;
  }
  target = $( '<input length="' + Math.min( 75, length ) +  '" id="' + id +  '"/>' );
  var msg = $( '<span class="alert alert-info"/>' );

  target.data( 'msg', msg );
  if( default_value !== undefined )
  {
    target.data( 'default', default_value );
  }

  target.on( 'clear', function()
    {
      var default_value = $( this ).data( 'default' );

      if( default_value !== undefined )
      {
        $( this ).val( default_value );
      }
      else
      {
        $( this ).val( '' );
      }
      $( this ).data( 'msg' ).empty();
      $( this ).data( 'msg' ).hide();

      return false;
    } );
  target.on( 'set', function( event, value ) { $( this ).val( value ); return false; }  );
  target.data( 'get', function( field ) { return $( field ).val(); } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function textAreaEdit( target, default_value )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<textarea rows="5" cols="75" id="' + id +  '"/>' );
  var msg = $( '<span class="alert alert-info"/>' );

  target.data( 'msg', msg );
  if( default_value !== undefined )
  {
    target.data( 'default', default_value );
  }

  target.on( 'clear', function()
    {
      var default_value = $( this ).data( 'default' );

      if( default_value !== undefined )
      {
        $( this ).val( default_value );
      }
      else
      {
        $( this ).val( '' );
      }
      $( this ).data( 'msg' ).empty();
      $( this ).data( 'msg' ).hide();

      return false;
    } );
  target.on( 'set', function( event, value ) { $( this ).val( value ); return false; }  );
  target.data( 'get', function( field ) { return $( field ).val(); } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function booleanView( target )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<span id="' + id +  '"/>' );
  var msg = $( '<span class="alert alert-info"/>' );

  target.data( 'msg', msg );
  target.on( 'clear', function() { $( this ).empty(); $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );
  target.on( 'set', function( event, value )
    {
      if( value )
      {
        $( this ).html( '<i class="glyphicon glyphicon-check"/>' );
      }
      else
      {
        $( this ).html( '<i class="glyphicon glyphicon-unchecked"/>' );
      }

      return false;
    } );
  target.data( 'get', function( field )
    {
      return $( field ).children()[0].getclass().indexOf( 'unchecked' );

      return false;
    } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function booleanEdit( target, default_value )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<input type="checkbox" id="' + id +  '"/>' );
  var msg = $( '<span class="alert alert-info"/>' );

  target.data( 'msg', msg );
  if( default_value !== undefined )
  {
    target.data( 'default', default_value );
  }

  target.on( 'clear', function()
    {
      var default_value = $( this ).data( 'default' );

      if( default_value !== undefined )
      {
        $( this ).prop( 'checked', default_value );
      }
      else
      {
        $( this ).prop( 'checked', false );
      }
      $( this ).data( 'msg' ).empty();
      $( this ).data( 'msg' ).hide();

      return false;
    } );
  target.on( 'set', function( event, value )
    {
      $( this ).prop( 'checked', value );

      return false;
    } );
  target.data( 'get', function( field )
    {
      return $( field ).prop( 'checked' );
    } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function mapView( target )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<table id="' + id +  '" class="table"><thead><tr><th>Key</th><th>Value</th><th>&nbsp;</th></tr></thead><tbody /></table>' );
  var msg = $( '<span class="alert alert-info"/>' );

  target.data( 'msg', msg );
  target.on( 'clear', function() { $( this ).find( 'tbody' ).empty(); $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );
  target.on( 'set', function( event, value )
    {
      var body = $( this ).find( 'tbody' )

      body.empty();
      for( var key in value )
      {
        var row = $( '<tr><td><span id="key" /></td><td><span id="value" /></td></tr>' );
        row.find( '#key' ).html( key );
        row.find( '#value' ).html( value[ key ] );
        body.append( row );
      }

      return false;
    } );
  target.data( 'get', function( field )
    {
      var body = $( field ).find( 'tbody' );
      var result = {}

      for( var row of body.children() )
      {
        row = $( row );
        result[ row.find( '#key' ).html() ] = row.find( '#value' ).html();
      }

      return result;
    } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function _removeMapEditRow( event )
{
  var row = $( event.target ).closest( 'tr' );
  row.remove();
}

const _mapEditRow = '<tr><td><input id="key" length="30"/></td><td><input id="value" length="30"/></td><td><button type="button" class="btn btn-default btn" id="remove"><span class="glyphicon glyphicon-minus" aria-hidden="true" /></button></td></tr>';

function mapEdit( target, default_value )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<table id="' + id +  '" class="table"><thead><tr><td>Key</td><td>Value</td><td><button type="button" class="btn btn-default btn" id="add"><span class="glyphicon glyphicon-plus" aria-hidden="true" /></button></td></tr></thead><tbody /></table>' );
  var msg = $( '<span class="alert alert-info"/>' );
  var body = $( this ).find( 'tbody' );

  target.data( 'msg', msg );
  if( default_value !== undefined )
  {
    target.data( 'default', default_value );
  }

  target.find( '#add' ).on( 'click', function()
    {
      var body = $( this ).closest( 'table' ).find( 'tbody' );
      var row = $( _mapEditRow );

      row.find( '#remove' ).on( 'click', _removeMapEditRow );
      body.append( row );

      return false;
    } );

  target.on( 'clear', function()
    {
      var body = $( this ).find( 'tbody' )
      var default_value = $( this ).data( 'default' );

      if( default_value !== undefined )
      {
        for( var key in default_value )
        {
          var row = $( _mapEditRow );
          row.find( '#remove' ).on( 'click', _removeMapEditRow );
          row.find( '#key' ).val( key );
          row.find( '#value' ).val( default_value[ key ] );
          body.append( row );
        }
      }
      else
      {
        body.empty();
      }
      $( this ).data( 'msg' ).empty();
      $( this ).data( 'msg' ).hide();

      return false;
    } );
  target.on( 'set', function( event, value )
    {
      var body = $( this ).find( 'tbody' );

      body.empty();
      for( var key in value )
      {
        var row = $( _mapEditRow );
        row.find( '#remove' ).on( 'click', _removeMapEditRow );

        row.find( '#key' ).val( key );
        row.find( '#value' ).val( value[ key ] );
        body.append( row );
      }

      return false;
    } );
  target.data( 'get', function( field )
    {
      var body = $( field ).find( 'tbody' );
      var result = {}

      for( var row of body.children() )
      {
        row = $( row );
        result[ row.find( '#key' ).val() ] = row.find( '#value' ).val();
      }

      return result;
    } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}

function _removeListEditRow( event )
{
  var row = $( event.target ).closest( 'tr' );
  row.remove();
}

const _listEditRow = '<tr><td><input id="value" length="30"/></td><td><button type="button" class="btn btn-default btn" id="remove"><span class="glyphicon glyphicon-minus" aria-hidden="true" /></button></td></tr>';

function listEdit( target, default_value )
{
  var id = target.attr( 'id' );
  var container = target.parent();
  target = $( '<table id="' + id +  '" class="table"><thead><tr><td>Value</td><td><button type="button" class="btn btn-default btn" id="add"><span class="glyphicon glyphicon-plus" aria-hidden="true" /></button></td></tr></thead><tbody /></table>' );
  var msg = $( '<span class="alert alert-info"/>' );
  var body = $( this ).find( 'tbody' );

  target.data( 'msg', msg );
  if( default_value !== undefined )
  {
    target.data( 'default', default_value );
  }

  target.find( '#add' ).on( 'click', function()
    {
      var body = $( this ).closest( 'table' ).find( 'tbody' );
      var row = $( _listEditRow );

      row.find( '#remove' ).on( 'click', _removeListEditRow );
      body.append( row );

      return false;
    } );

  target.on( 'clear', function()
    {
      var body = $( this ).find( 'tbody' )
      var default_value = $( this ).data( 'default' );

      if( default_value !== undefined )
      {
        for( var key in default_value )
        {
          var row = $( _listEditRow );
          row.find( '#remove' ).on( 'click', _removeListEditRow );
          row.find( '#value' ).val( default_value[ key ] );
          body.append( row );
        }
      }
      else
      {
        body.empty();
      }
      $( this ).data( 'msg' ).empty();
      $( this ).data( 'msg' ).hide();

      return false;
    } );
  target.on( 'set', function( event, value )
    {
      var body = $( this ).find( 'tbody' );

      body.empty();
      for( var index in value )
      {
        var row = $( _listEditRow );
        row.find( '#remove' ).on( 'click', _removeListEditRow );

        row.find( '#value' ).val( value[ index ] );
        body.append( row );
      }

      return false;
    } );
  target.data( 'get', function( field )
    {
      var body = $( field ).find( 'tbody' );
      var result = []

      for( var row of body.children() )
      {
        row = $( row );
        result.push( row.find( '#value' ).val() );
      }

      return result;
    } );
  target.on( 'error', function( event, msg ) { $( this ).data( 'msg' ).html( msg ); $( this ).data( 'msg' ).show(); return false; } );
  target.on( 'error_clear', function() { $( this ).data( 'msg' ).empty(); $( this ).data( 'msg' ).hide(); return false; } );

  container.empty();
  container.append( target );
  container.append( msg );
}
