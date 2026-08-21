import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiParam } from '@nestjs/swagger';
import { FiscalService } from './fiscal.service';
import { SefService } from './sef.service';
import { EturistaService } from './eturista.service';
import { CreateSefInvoiceDto, CreateEturistaBatchDto } from './dto/rs-compliance.dto';
import { PropertyId } from '../../common/decorators/tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Usklađenost RS (fiskalizacija/SEF/eTurista)')
@ApiSecurity('property-context')
@Controller('rs-compliance')
export class RsComplianceController {
  constructor(
    private readonly fiscalService: FiscalService,
    private readonly sefService: SefService,
    private readonly eturistaService: EturistaService,
  ) {}

  @Get('fiscal-documents/by-folio/:folioId')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Fiskalni računi izdati za folio (izdaju se automatski pri svakoj uplati)' })
  @ApiParam({ name: 'folioId', type: 'string', format: 'uuid' })
  findFiscalByFolio(@PropertyId() propertyId: string, @Param('folioId') folioId: string) {
    return this.fiscalService.findByFolio(propertyId, folioId);
  }

  @Post('sef-invoices')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Kreiraj SEF e-Fakturu (nacrt) za folio — B2B/B2G' })
  createSefInvoice(@PropertyId() propertyId: string, @Body() dto: CreateSefInvoiceDto) {
    return this.sefService.createInvoice(propertyId, dto);
  }

  @Post('sef-invoices/:id/submit')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Pošalji SEF fakturu (draft → submitted)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  submitSefInvoice(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.sefService.submitInvoice(propertyId, id);
  }

  @Get('sef-invoices')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Lista SEF faktura objekta' })
  findSefInvoices(@PropertyId() propertyId: string) {
    return this.sefService.findInvoices(propertyId);
  }

  @Get('sef-invoices/:id')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Detalji SEF fakture' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findSefInvoiceById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.sefService.findInvoiceById(propertyId, id);
  }

  @Post('eturista/batches')
  @RequirePermissions('finance:manage')
  @ApiOperation({
    summary: 'Sastavi eTurista batch (prijava gostiju + boravišna taksa) za period',
    description: 'Skenira checked_out rezervacije sa checkOut u periodu. Boravišna taksa = noćenja × odrasli × property.touristTaxPerNight.',
  })
  createEturistaBatch(@PropertyId() propertyId: string, @Body() dto: CreateEturistaBatchDto) {
    return this.eturistaService.createBatch(propertyId, dto);
  }

  @Post('eturista/batches/:id/submit')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Pošalji eTurista batch (pending → submitted)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  submitEturistaBatch(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eturistaService.submitBatch(propertyId, id);
  }

  @Get('eturista/batches')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Lista eTurista batch-eva objekta' })
  findEturistaBatches(@PropertyId() propertyId: string) {
    return this.eturistaService.findBatches(propertyId);
  }

  @Get('eturista/batches/:id')
  @RequirePermissions('finance:manage')
  @ApiOperation({ summary: 'Detalji eTurista batch-a (spisak gostiju)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  findEturistaBatchById(@PropertyId() propertyId: string, @Param('id') id: string) {
    return this.eturistaService.findBatchById(propertyId, id);
  }
}
